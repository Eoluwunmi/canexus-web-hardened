import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { discoverySkills, discoverySessions, resumeParses } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";

/**
 * GET /api/discovery/skills?sessionId=...
 * Fetch extracted skills for a discovery session.
 */
export async function GET(request: NextRequest) {
  try {
    const userSession = await auth();
    if (!userSession?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId required" },
        { status: 400 }
      );
    }

    // Verify session ownership
    const session = await db
      .select()
      .from(discoverySessions)
      .where(
        and(
          eq(discoverySessions.id, sessionId),
          eq(discoverySessions.userId, userSession.user.id)
        )
      )
      .then((rows) => rows[0]);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Fetch discovered skills for this session
    const discoveredSkills = await db
      .select()
      .from(discoverySkills)
      .where(eq(discoverySkills.sessionId, sessionId));

    // Fetch resume skills if resume is linked to this session
    let resumeSkills: any[] = [];
    if (session.linkedResumeParseId) {
      const resumeParse = await db.query.resumeParses.findFirst({
        where: eq(resumeParses.id, session.linkedResumeParseId),
      });

      const extractedData = resumeParse?.extractedData as any;
      if (extractedData?.skills && Array.isArray(extractedData.skills)) {
        resumeSkills = extractedData.skills
          .filter((skill: any) => skill && skill.name) // Filter out empty skills
          .map((skill: any) => ({
            skillName: skill.name,
            proficiencyLevel: skill.years_experience ? (skill.years_experience > 5 ? "EXPERT" : skill.years_experience > 2 ? "ADVANCED" : "INTERMEDIATE") : "INTERMEDIATE",
            confidence: 0.95, // Resume extraction typically has very high confidence
            evidenceSnippet: `From resume: ${skill.name}`,
            source: "RESUME",
          }));
      }
    }

    return NextResponse.json({
      sessionId,
      discoveredSkills: discoveredSkills.map((s) => ({
        skillName: s.skillName,
        proficiencyLevel: s.proficiencyLevel,
        confidence: s.confidence,
        evidenceSnippet: s.evidenceSnippet,
        source: "DISCOVERY",
      })),
      resumeSkills,
      hasResumeLinked: !!session.linkedResumeParseId,
    });
  } catch (error) {
    console.error("Error fetching discovery skills:", error);
    return NextResponse.json(
      { error: "Failed to fetch skills" },
      { status: 500 }
    );
  }
}
