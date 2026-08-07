import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { discoverySessions, resumeParses, resumes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";

/**
 * POST /api/discovery/attach-resume
 * Link a resume (resumeParse) to a discovery session.
 * Allows users to upload/attach a resume during the discovery flow for skill merging.
 * Body: { sessionId, resumeParseId }
 */
export async function POST(request: NextRequest) {
  try {
    const userSession = await auth();
    if (!userSession?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, resumeParseId } = await request.json();

    if (!sessionId || !resumeParseId) {
      return NextResponse.json(
        { error: "sessionId and resumeParseId are required" },
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
      return NextResponse.json(
        { error: "Discovery session not found or unauthorized" },
        { status: 404 }
      );
    }

    // Verify resume parse exists
    const parse = await db.query.resumeParses.findFirst({
      where: eq(resumeParses.id, resumeParseId),
    });

    if (!parse) {
      return NextResponse.json(
        { error: "Resume not found" },
        { status: 404 }
      );
    }

    // Verify resume belongs to the same user
    const resume = await db.query.resumes.findFirst({
      where: eq(resumes.id, parse.resumeId),
    });

    if (!resume) {
      return NextResponse.json(
        { error: "Resume not found" },
        { status: 404 }
      );
    }

    // Link resume to discovery session
    const updated = await db
      .update(discoverySessions)
      .set({ linkedResumeParseId: resumeParseId })
      .where(eq(discoverySessions.id, sessionId))
      .returning();

    return NextResponse.json({
      sessionId,
      linkedResumeParseId: resumeParseId,
      message: "Resume linked to discovery session",
    });
  } catch (error) {
    console.error("Error attaching resume to discovery session:", error);
    return NextResponse.json(
      { error: "Failed to attach resume" },
      { status: 500 }
    );
  }
}
