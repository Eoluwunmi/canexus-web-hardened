/**
 * GET /api/resumes/review-queue
 * Returns paginated list of resumes needing review.
 * Filters: status, needs_review, confidence_threshold
 */

import { auth } from "@/auth";
import { db } from "@/db";
import { resumes, resumeParses, users } from "@/db/schema";
import { eq, and, gte, or } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can review
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (user?.role !== "ADMIN" && !user?.isEmployerAdmin) {
      return Response.json({ error: "Only admins can review resumes" }, { status: 403 });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 100);
    const confidenceThreshold = parseFloat(
      url.searchParams.get("confidence_threshold") ?? "0.85"
    );
    const filter = url.searchParams.get("filter") ?? "needs_review"; // needs_review, low_confidence, failed, completed

    const offset = (page - 1) * limit;

    // Build filter conditions
    let whereConditions: any[] = [];

    if (filter === "needs_review") {
      whereConditions.push(eq(resumeParses.needsReview, true));
    } else if (filter === "low_confidence") {
      whereConditions.push(gte(resumeParses.overallConfidence, 0));
      whereConditions.push(gte(confidenceThreshold, resumeParses.overallConfidence));
    } else if (filter === "failed") {
      whereConditions.push(eq(resumeParses.status, "FAILED"));
    } else if (filter === "completed") {
      whereConditions.push(eq(resumeParses.status, "COMPLETED"));
    }

    // Query
    const parseResults = await db
      .select({
        parseId: resumeParses.id,
        resumeId: resumeParses.resumeId,
        fileName: resumes.fileName,
        status: resumeParses.status,
        overallConfidence: resumeParses.overallConfidence,
        needsReview: resumeParses.needsReview,
        parsedAt: resumeParses.parsedAt,
        uploadedAt: resumes.uploadedAt,
      })
      .from(resumeParses)
      .innerJoin(resumes, eq(resumeParses.resumeId, resumes.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(resumeParses.parsedAt)
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: resumeParses.id })
      .from(resumeParses)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    const total = totalResult.length;
    const totalPages = Math.ceil(total / limit);

    return Response.json(
      {
        data: parseResults,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        filter,
        confidenceThreshold,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Review queue error:", error);
    return Response.json(
      { error: "Failed to fetch review queue", details: String(error) },
      { status: 500 }
    );
  }
}
