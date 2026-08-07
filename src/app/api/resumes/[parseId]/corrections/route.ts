/**
 * POST /api/resumes/{parseId}/corrections
 * Save a correction to a parsed field.
 * Appends to parse_corrections table (labeled dataset).
 */

import { auth } from "@/auth";
import { db } from "@/db";
import { parseCorrections, resumeParses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const CorrectionSchema = z.object({
  fieldPath: z.string().min(1, "Field path required"),
  originalValue: z.string().nullable(),
  correctedValue: z.string().min(1, "Corrected value required"),
  notes: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ parseId: string }> }
) {
  try {
    const { parseId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate
    const validation = CorrectionSchema.safeParse(body);
    if (!validation.success) {
      return Response.json(
        { error: "Validation failed", details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { fieldPath, originalValue, correctedValue, notes } = validation.data;

    // Verify parse exists
    const parse = await db.query.resumeParses.findFirst({
      where: eq(resumeParses.id, parseId),
    });

    if (!parse) {
      return Response.json({ error: "Parse not found" }, { status: 404 });
    }

    // Create correction record
    const correction = await db
      .insert(parseCorrections)
      .values({
        parseId,
        correctedByUserId: session.user.id,
        fieldPath,
        originalValue,
        correctedValue,
        notes: notes || null,
      })
      .returning();

    return Response.json(
      {
        correctionId: correction[0]?.id,
        fieldPath,
        originalValue,
        correctedValue,
        correctedAt: correction[0]?.correctedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Correction save error:", error);
    return Response.json(
      { error: "Failed to save correction", details: String(error) },
      { status: 500 }
    );
  }
}
