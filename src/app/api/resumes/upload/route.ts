/**
 * POST /api/resumes/upload
 * Upload a resume file and queue for parsing.
 * Returns { parseId, status, uploadedAt }
 */

import { auth } from "@/auth";
import { db } from "@/db";
import { resumes, resumeParses } from "@/db/schema";
import { uploadToS3 } from "@/lib/storage";
import { hashFile, extractResumeText } from "@/lib/resume-extraction";
import { parseResumeWithLLM } from "@/lib/resume-llm";
import { logAudit } from "@/lib/audit";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size (max 20 MB)
    if (file.size > 20 * 1024 * 1024) {
      return Response.json({ error: "File too large (max 20 MB)" }, { status: 400 });
    }

    // Validate file format
    const supportedFormats = ["pdf", "docx", "doc", "txt"];
    const fileExt = file.name.split(".").pop()?.toLowerCase();
    if (!fileExt || !supportedFormats.includes(fileExt)) {
      return Response.json(
        { error: `Unsupported file format. Supported: ${supportedFormats.join(", ")}` },
        { status: 400 }
      );
    }

    // Read file into buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = hashFile(buffer);

    // Check for duplicate (same file already uploaded)
    const existingResume = await db.query.resumes.findFirst({
      where: eq(resumes.fileHash, fileHash),
    });

    if (existingResume && existingResume.id) {
      // Return existing parse if it exists
      const existingParse = await db.query.resumeParses.findFirst({
        where: eq(resumeParses.resumeId, existingResume.id),
      });

      if (existingParse) {
        await logAudit({
          actorUserId: session.user.id,
          action: "RESUME_DUPLICATE_UPLOADED",
          targetResource: "resume",
          metadata: {
            resumeId: existingParse.id,
            fileName: file.name,
          },
        });

        return Response.json(
          {
            parseId: existingParse.id,
            status: existingParse.status,
            isDuplicate: true,
            uploadedAt: existingResume.uploadedAt,
          },
          { status: 200 }
        );
      }
    }

    // Upload file to S3
    const storageKey = `resumes/${session.user.id}/${Date.now()}_${file.name}`;
    await uploadToS3(storageKey, buffer, file.type);

    // Create resume record
    const newResume = await db
      .insert(resumes)
      .values({
        uploadedByUserId: session.user.id,
        fileName: file.name,
        fileFormat: fileExt,
        storageKey,
        fileSizeBytes: file.size,
        fileHash,
      })
      .returning();

    if (!newResume[0]?.id) {
      throw new Error("Failed to create resume record");
    }

    // Create parse record (status: PENDING initially)
    const newParse = await db
      .insert(resumeParses)
      .values({
        resumeId: newResume[0].id,
        status: "PENDING",
      })
      .returning();

    if (!newParse[0]?.id) {
      throw new Error("Failed to create parse record");
    }

    // Parse resume immediately with LLM
    try {
      const extraction = await extractResumeText(buffer, fileExt);
      const rawText = extraction.rawText;

      let parsed;
      if (process.env.ANTHROPIC_API_KEY) {
        // Use Claude for advanced parsing if API key is available
        parsed = await parseResumeWithLLM(
          rawText,
          newResume[0].id,
          file.name,
          fileHash,
          extraction.pageCount
        );
      } else {
        // Fallback: extract basic skills from resume text without LLM
        const skillKeywords = ['javascript', 'typescript', 'python', 'react', 'node.js', 'express', 'postgresql', 'mongodb', 'aws', 'docker', 'git', 'sql', 'html', 'css', 'java', 'c++', 'php', 'ruby', 'go', 'rust', 'kubernetes', 'azure', 'gcp'];
        const foundSkills = skillKeywords
          .filter(skill => rawText.toLowerCase().includes(skill))
          .map(name => ({
            name,
            canonical_id: null,
            category: 'Technology',
            evidence_span_ids: [],
            inferred: false,
            years_experience: null,
            last_used_year: null,
          }));

        parsed = {
          candidate_id: newResume[0].id,
          source: { file_id: newResume[0].id, filename: file.name, sha256: fileHash, pages: extraction.pageCount, extraction_method: extraction.method },
          identity: { full_name: null, given_name: null, family_name: null, emails: [], phones: [], location: { city: null, region: null, country: null, raw: null }, links: [] },
          work_authorization: { stated: null, raw_text: null },
          summary: rawText.substring(0, 500),
          experience: [],
          education: [],
          skills: foundSkills,
          certifications: [],
          languages: [],
          publications: [],
          projects: [],
          volunteer: [],
          awards: [],
          derived: { total_experience_months: 0, experience_by_skill: {}, employment_gaps: [], average_tenure_months: 0, career_trajectory: 'unknown' as const },
          quality: { field_confidence: {}, overall_confidence: 0.5, needs_review: true, review_reasons: ['Using fallback skill extraction - configure ANTHROPIC_API_KEY for full parsing'] },
        };
      }

      // Update parse record with results
      await db
        .update(resumeParses)
        .set({
          status: "COMPLETED",
          extractedData: parsed,
          parsedAt: new Date(),
        })
        .where(eq(resumeParses.id, newParse[0].id));
    } catch (parseError) {
      console.error("Resume parsing error:", parseError);
      // Mark as failed but don't throw - user can still use upload without parsing
      await db
        .update(resumeParses)
        .set({
          status: "FAILED",
          needsReview: true,
          reviewReasons: `Parsing failed: ${String(parseError)}`,
        })
        .where(eq(resumeParses.id, newParse[0].id));
    }

    await logAudit({
      actorUserId: session.user.id,
      action: "RESUME_UPLOADED",
      targetResource: "resume",
      metadata: {
        resumeId: newResume[0].id,
        parseId: newParse[0].id,
        fileName: file.name,
      },
    });

    return Response.json(
      {
        parseId: newParse[0].id,
        resumeId: newResume[0].id,
        status: "COMPLETED",
        uploadedAt: newResume[0].uploadedAt,
        message: "Resume uploaded and parsed successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Resume upload error:", error);
    return Response.json(
      { error: "Failed to upload resume", details: String(error) },
      { status: 500 }
    );
  }
}
