/**
 * GET /api/resumes/{parseId}
 * Returns parsed resume data + metadata for review UI
 */

import { auth } from "@/auth";
import { db } from "@/db";
import { resumeParses, resumes, parseCorrections } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ parseId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { parseId } = await params;

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

    // Get corrections already made
    const corrections = await db.query.parseCorrections.findMany({
      where: eq(parseCorrections.parseId, parseId),
    });

    return Response.json(
      {
        parseId,
        resumeId: parse.resumeId,
        fileName: resume.fileName,
        fileFormat: resume.fileFormat,
        status: parse.status,
        extractedData: parse.extractedData,
        overallConfidence: parse.overallConfidence,
        fieldConfidence: parse.fieldConfidence,
        needsReview: parse.needsReview,
        reviewReasons: parse.reviewReasons?.split("; ") || [],
        corrections: corrections.map((c) => ({
          fieldPath: c.fieldPath,
          originalValue: c.originalValue,
          correctedValue: c.correctedValue,
          notes: c.notes,
          correctedAt: c.correctedAt,
        })),
        uploadedAt: resume.uploadedAt,
        parsedAt: parse.parsedAt,
        storageKey: resume.storageKey,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Resume detail error:", error);
    return Response.json(
      { error: "Failed to fetch resume", details: String(error) },
      { status: 500 }
    );
  }
}
