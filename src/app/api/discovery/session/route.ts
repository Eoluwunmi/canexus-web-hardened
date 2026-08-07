import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { discoverySessions, discoverySessionStatusEnum } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

/**
 * POST /api/discovery/session
 * Create or update a discovery session for the current user.
 * Body: { step: 'quiz'|'narrative'|'extraction'|'confirmation', quizResponses?, narrativeContent?, narrativeMetadata?, targetOccupationId? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { step, quizResponses, narrativeContent, narrativeMetadata, targetOccupationId } = await request.json();

    // Find existing active session for this user
    let discoverySession = await db
      .select()
      .from(discoverySessions)
      .where(eq(discoverySessions.userId, session.user.id))
      .then((rows) => rows[0]);

    if (!discoverySession) {
      // Create new session
      const result = await db
        .insert(discoverySessions)
        .values({
          userId: session.user.id,
          status: "ACTIVE",
          quizResponses: quizResponses || null,
          narrativeContent: narrativeContent || null,
          narrativeMetadata: narrativeMetadata || null,
          targetOccupationId: targetOccupationId || null,
        })
        .returning();

      discoverySession = result[0];
    } else {
      // Update existing session
      const updateData: any = {};
      if (quizResponses !== undefined) updateData.quizResponses = quizResponses;
      if (narrativeContent !== undefined) updateData.narrativeContent = narrativeContent;
      if (narrativeMetadata !== undefined) updateData.narrativeMetadata = narrativeMetadata;
      if (targetOccupationId !== undefined) updateData.targetOccupationId = targetOccupationId;

      const result = await db
        .update(discoverySessions)
        .set(updateData)
        .where(eq(discoverySessions.id, discoverySession.id))
        .returning();

      discoverySession = result[0];
    }

    return NextResponse.json({
      sessionId: discoverySession.id,
      status: discoverySession.status,
      step: "progress", // User can continue to next step
    });
  } catch (error) {
    console.error("Error in discovery session:", error);
    return NextResponse.json(
      { error: "Failed to create/update session" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/discovery/session
 * Retrieve current active discovery session for the user.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const discoverySession = await db
      .select()
      .from(discoverySessions)
      .where(eq(discoverySessions.userId, session.user.id))
      .then((rows) => rows[0]);

    if (!discoverySession) {
      return NextResponse.json({ error: "No active session" }, { status: 404 });
    }

    return NextResponse.json({
      sessionId: discoverySession.id,
      status: discoverySession.status,
      quizResponses: discoverySession.quizResponses,
      narrativeContent: discoverySession.narrativeContent,
      narrativeMetadata: discoverySession.narrativeMetadata,
      targetOccupationId: discoverySession.targetOccupationId,
      createdAt: discoverySession.createdAt,
    });
  } catch (error) {
    console.error("Error retrieving discovery session:", error);
    return NextResponse.json({ error: "Failed to retrieve session" }, { status: 500 });
  }
}
