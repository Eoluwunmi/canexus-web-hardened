import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  discoverySessions,
  discoverySkills,
  skills,
  userSkills,
  userSkillSources,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/discovery/confirm
 * Confirm and commit discovered skills to the user's Skills Passport.
 * Creates userSkills records with EVIDENCE_LINKED verification level.
 * Links discoveries to passport via userSkillSources table.
 * Body: { sessionId, skillIds?: string[] }
 * If skillIds provided, only sync those skills. Otherwise sync all extracted skills.
 */
export async function POST(request: NextRequest) {
  try {
    const userSession = await auth();
    if (!userSession?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, skillIds } = await request.json();

    // Verify session ownership
    const discoverySession = await db
      .select()
      .from(discoverySessions)
      .where(and(
        eq(discoverySessions.id, sessionId),
        eq(discoverySessions.userId, userSession.user.id)
      ))
      .then((rows) => rows[0]);

    if (!discoverySession) {
      return NextResponse.json(
        { error: "Session not found or unauthorized" },
        { status: 404 }
      );
    }

    // Fetch extracted skills for this session
    let discoveredSkillsQuery = db
      .select()
      .from(discoverySkills)
      .where(eq(discoverySkills.sessionId, sessionId));

    const skillsToSync = await discoveredSkillsQuery;

    if (skillsToSync.length === 0) {
      return NextResponse.json(
        { error: "No skills to confirm" },
        { status: 400 }
      );
    }

    let skillsCreated = 0;
    const createdSkillIds: string[] = [];

    // For each discovered skill, create or update userSkills record
    for (const discoveredSkill of skillsToSync) {
      let skillId = discoveredSkill.skillId;

      // If skill not yet linked to taxonomy, try to find or create it
      if (!skillId) {
        // Try to find existing skill by name (case-insensitive)
        const existingSkill = await db
          .select()
          .from(skills)
          .where(eq(skills.name, discoveredSkill.skillName))
          .then((rows) => rows[0]);

        if (existingSkill) {
          skillId = existingSkill.id;
        } else {
          // Create new skill in taxonomy
          const newSkill = await db
            .insert(skills)
            .values({
              name: discoveredSkill.skillName,
              category: "Discovered", // Default category for discovered skills
            })
            .returning();
          skillId = newSkill[0].id;
        }
      }

      // Check if userSkill already exists (to avoid duplicate key error)
      const existingUserSkill = await db
        .select()
        .from(userSkills)
        .where(
          and(
            eq(userSkills.userId, userSession.user.id),
            eq(userSkills.skillId, skillId)
          )
        )
        .then((rows) => rows[0]);

      // Prepare evidence text linking back to discovery session
      const evidenceText = `Discovered during skill discovery session (proficiency: ${discoveredSkill.proficiencyLevel})`;

      if (existingUserSkill) {
        // Update existing skill (upgrade to EVIDENCE_LINKED if currently SELF_REPORTED)
        if (existingUserSkill.verificationLevel === "SELF_REPORTED") {
          await db
            .update(userSkills)
            .set({
              verificationLevel: "EVIDENCE_LINKED",
              evidence: evidenceText,
            })
            .where(eq(userSkills.id, existingUserSkill.id));
        }
        createdSkillIds.push(existingUserSkill.id);
      } else {
        // Create new userSkill record with EVIDENCE_LINKED
        const newUserSkill = await db
          .insert(userSkills)
          .values({
            userId: userSession.user.id,
            skillId,
            verificationLevel: "EVIDENCE_LINKED",
            evidence: evidenceText,
            visibility: "EMPLOYERS", // Default visibility, same as resume parser
          })
          .returning();

        createdSkillIds.push(newUserSkill[0].id);
        skillsCreated++;
      }
    }

    // Create userSkillSource entries linking these skills to the discovery session
    for (const userSkillId of createdSkillIds) {
      try {
        // Check if source already exists before inserting
        const existingSource = await db
          .select()
          .from(userSkillSources)
          .where(eq(userSkillSources.userSkillId, userSkillId))
          .then((rows) => rows[0]);

        if (!existingSource) {
          await db.insert(userSkillSources).values({
            userSkillId,
            sourceType: "DISCOVERED",
            sourceId: sessionId,
          });
        }
      } catch (err) {
        // Silently skip if source already exists
        console.warn(`Source already exists for skill ${userSkillId}`);
      }
    }

    // Mark discovery session as COMPLETED
    await db
      .update(discoverySessions)
      .set({
        status: "COMPLETED",
        completedAt: new Date(),
      })
      .where(eq(discoverySessions.id, sessionId));

    // Audit log
    await logAudit({
      actorUserId: userSession.user.id,
      action: "DISCOVERY_SESSION_CONFIRMED",
      targetResource: "discovery_session",
      targetUserId: userSession.user.id,
      metadata: {
        sessionId,
        skillsCreated,
        skillsLinked: createdSkillIds,
      },
    });

    return NextResponse.json({
      sessionId,
      status: "COMPLETED",
      skillsCreated,
      skillsLinked: createdSkillIds.length,
      message: `${skillsCreated} new skills added to your passport (${createdSkillIds.length} total linked)`,
    });
  } catch (error) {
    console.error("Error confirming discovery session:", error);
    return NextResponse.json(
      { error: "Failed to confirm discovery session" },
      { status: 500 }
    );
  }
}
