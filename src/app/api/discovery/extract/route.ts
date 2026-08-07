import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { discoverySessions, discoverySkills } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { extractSkillsFromNarrative } from "@/lib/discovery-llm";

/**
 * POST /api/discovery/extract
 * Call Claude to extract skills from the user's narrative.
 * Returns extracted skills with confidence scores and evidence snippets.
 * Body: { sessionId, narrativeContent, narrativeMetadata? }
 */
export async function POST(request: NextRequest) {
  try {
    const userSession = await auth();
    if (!userSession?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, narrativeContent, narrativeMetadata } =
      await request.json();

    // Verify session ownership
    const discoverySession = await db
      .select()
      .from(discoverySessions)
      .where(eq(discoverySessions.id, sessionId))
      .then((rows) => rows[0]);

    if (!discoverySession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (discoverySession.userId !== userSession.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!narrativeContent || narrativeContent.trim().length === 0) {
      return NextResponse.json(
        { error: "Narrative content is required" },
        { status: 400 }
      );
    }

    // Call Claude to extract skills
    const extractedSkills = await extractSkillsFromNarrative(
      narrativeContent,
      narrativeMetadata
    );

    // Calculate average confidence
    const avgConfidence =
      extractedSkills.length > 0
        ? extractedSkills.reduce((sum, s) => sum + s.confidence, 0) /
          extractedSkills.length
        : 0;

    // Store extracted skills in discoverySkills table
    if (extractedSkills.length > 0) {
      await db.insert(discoverySkills).values(
        extractedSkills.map((skill) => ({
          sessionId,
          skillId: null, // Will be populated during confirmation step
          skillName: skill.skillName,
          proficiencyLevel: skill.proficiencyLevel,
          confidence: skill.confidence,
          evidenceSnippet: skill.evidenceSnippet,
        }))
      );
    }

    // Update session with extraction confidence
    await db
      .update(discoverySessions)
      .set({
        extractionConfidence: avgConfidence,
        narrativeContent,
        narrativeMetadata,
      })
      .where(eq(discoverySessions.id, sessionId));

    return NextResponse.json({
      sessionId,
      skillsExtracted: extractedSkills.length,
      overallConfidence: avgConfidence,
      skills: extractedSkills,
    });
  } catch (error) {
    console.error("Error extracting skills:", error);
    return NextResponse.json(
      { error: "Failed to extract skills from narrative" },
      { status: 500 }
    );
  }
}
