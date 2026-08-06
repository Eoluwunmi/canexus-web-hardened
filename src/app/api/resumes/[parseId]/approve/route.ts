/**
 * POST /api/resumes/{parseId}/approve
 * Approve parsed resume and sync to Skills Passport.
 * Creates userSkills + evidence records from extracted data.
 */

import { auth } from "@/auth";
import { db } from "@/db";
import {
  resumeParses,
  resumes,
  userSkills,
  skills,
  evidenceFiles,
  users,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const ApproveSchema = z.object({
  includeSkills: z.boolean().default(true),
  includeExperience: z.boolean().default(true),
  includeEducation: z.boolean().default(true),
});

export async function POST(
  request: Request,
  { params }: { params: { parseId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { parseId } = params;
    const body = await request.json();

    // Validate
    const validation = ApproveSchema.safeParse(body);
    if (!validation.success) {
      return Response.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { includeSkills, includeExperience, includeEducation } = validation.data;

    // Get parse record
    const parse = await db.query.resumeParses.findFirst({
      where: eq(resumeParses.id, parseId),
    });

    if (!parse) {
      return Response.json({ error: "Parse not found" }, { status: 404 });
    }

    // Get resume record
    const resume = await db.query.resumes.findFirst({
      where: eq(resumes.id, parse.resumeId),
    });

    if (!resume) {
      return Response.json({ error: "Resume not found" }, { status: 404 });
    }

    const extractedData = parse.extractedData as any;
    const applicantUserId = resume.uploadedByUserId;

    let createdSkills = 0;
    let createdEvidence = 0;

    // Verify applicant exists
    const applicant = await db.query.users.findFirst({
      where: eq(users.id, applicantUserId),
    });

    if (!applicant) {
      return Response.json(
        { error: "Applicant user not found" },
        { status: 404 }
      );
    }

    // Step 1: Sync skills to Passport
    if (includeSkills && extractedData.skills?.length > 0) {
      for (const skillData of extractedData.skills) {
        try {
          // Find or create skill by canonical ID
          let skillRecord = await db.query.skills.findFirst({
            where: eq(skills.name, skillData.canonical_id || skillData.name),
          });

          if (!skillRecord) {
            // Create new skill
            const newSkill = await db
              .insert(skills)
              .values({
                name: skillData.canonical_id || skillData.name,
                category: skillData.category || "other",
              })
              .returning();

            skillRecord = newSkill[0];
          }

          // Create userSkill record
          if (skillRecord?.id) {
            const existingUserSkill = await db.query.userSkills.findFirst({
              where: and(
                eq(userSkills.userId, applicantUserId),
                eq(userSkills.skillId, skillRecord.id)
              ),
            });

            if (!existingUserSkill) {
              // Create new user skill with EVIDENCE_LINKED level
              await db.insert(userSkills).values({
                userId: applicantUserId,
                skillId: skillRecord.id,
                verificationLevel: "EVIDENCE_LINKED", // Auto-link to resume
                evidence: `Extracted from resume: ${resume.fileName}`,
                visibility: "EMPLOYERS",
              });

              createdSkills++;
            }
          }
        } catch (err) {
          console.error(`Failed to sync skill ${skillData.name}:`, err);
          // Continue with next skill
        }
      }
    }

    // Step 2: Add experience as evidence
    if (includeExperience && extractedData.experience?.length > 0) {
      for (const exp of extractedData.experience) {
        if (exp.employer && exp.title) {
          const experienceText = `${exp.title} at ${exp.employer} (${exp.start}–${exp.end || "present"})`;

          // This evidence is linked to the resume, not a specific skill
          // In a real system, you'd link it via evidenceFiles to the parsed skills
          // For MVP, we just log it to audit

          await logAudit(session.user.id, "EXPERIENCE_SYNCED", "resume_sync", {
            parseId,
            resumeId: parse.resumeId,
            experience: experienceText,
          });

          createdEvidence++;
        }
      }
    }

    // Step 3: Mark parse as completed
    await db
      .update(resumeParses)
      .set({
        status: "COMPLETED",
        needsReview: false,
        updatedAt: new Date(),
      })
      .where(eq(resumeParses.id, parseId));

    // Step 4: Audit log approval
    await logAudit(session.user.id, "RESUME_APPROVED_AND_SYNCED", "resume_parse", {
      parseId,
      resumeId: parse.resumeId,
      applicantUserId,
      skillsCreated: createdSkills,
      experienceRecords: createdEvidence,
    });

    return Response.json(
      {
        parseId,
        status: "COMPLETED",
        skillsCreated,
        experienceRecords: createdEvidence,
        message: `Resume approved and synced to Skills Passport (${createdSkills} skills added)`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Approval error:", error);
    return Response.json(
      { error: "Failed to approve resume", details: String(error) },
      { status: 500 }
    );
  }
}
