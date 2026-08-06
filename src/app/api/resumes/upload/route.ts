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
        await logAudit(session.user.id, "RESUME_DUPLICATE_UPLOADED", "resume", {
          resumeId: existingParse.id,
          fileName: file.name,
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

    // Create parse record (status: PENDING)
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

    // Queue for parsing (TODO: emit to job queue)
    await logAudit(session.user.id, "RESUME_UPLOADED", "resume", {
      resumeId: newResume[0].id,
      parseId: newParse[0].id,
      fileName: file.name,
    });

    return Response.json(
      {
        parseId: newParse[0].id,
        resumeId: newResume[0].id,
        status: "PENDING",
        uploadedAt: newResume[0].uploadedAt,
        message: "Resume uploaded and queued for parsing",
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
