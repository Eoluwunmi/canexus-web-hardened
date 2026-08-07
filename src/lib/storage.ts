import { S3Client, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

// Volume 8 / SECURITY.md: Canadian region by default. S3_ENDPOINT is optional — set it to use
// a non-AWS S3-compatible provider (Cloudflare R2, Backblaze B2, MinIO, DO Spaces); leave unset
// for real AWS S3. S3_FORCE_PATH_STYLE is typically needed for MinIO/self-hosted providers.
function getS3Client(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION || "ca-central-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

function getBucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("S3_BUCKET is not configured — see .env.example");
    }
    // Development fallback: use local file system
    return "local-dev";
  }
  return bucket;
}

function isUsingLocalStorage(): boolean {
  return !process.env.S3_BUCKET && process.env.NODE_ENV !== "production";
}

async function ensureLocalStorageDir(dirPath: string): Promise<void> {
  if (isUsingLocalStorage()) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      console.warn("Could not create local storage directory:", error);
    }
  }
}

export const EVIDENCE_ALLOWED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;
export const EVIDENCE_ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"] as const;
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024; // 10MB
export const EVIDENCE_MAX_FILES_PER_SKILL = 5;

// Both the extension AND the declared mimetype must agree — a mismatched pair (e.g. a
// ".pdf" filename with an image/png content-type) is rejected rather than trusting either
// signal alone. This still can't inspect the actual file bytes for spoofing (see the
// "malware scanning is NOT implemented" note in SECURITY.md), but it closes the trivial
// rename-the-extension bypass.
const EXTENSION_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export function validateEvidenceFile(fileName: string, mimeType: string, sizeBytes: number): { ok: true } | { ok: false; error: string } {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  if (!(EVIDENCE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return { ok: false, error: "Only PDF, PNG, and JPEG files are allowed." };
  }
  if (!(EVIDENCE_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return { ok: false, error: "Only PDF, PNG, and JPEG files are allowed." };
  }
  if (EXTENSION_TO_MIME[ext] !== mimeType) {
    return { ok: false, error: "The file extension doesn't match its declared type." };
  }
  if (sizeBytes <= 0 || sizeBytes > EVIDENCE_MAX_BYTES) {
    return { ok: false, error: "Files must be under 10MB." };
  }
  return { ok: true };
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

export function buildEvidenceStorageKey(userId: string, userSkillId: string, fileName: string): string {
  return `evidence/${userId}/${userSkillId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
}

/**
 * Presigned POST policy for direct browser → S3 upload. Using a POST policy (not a plain
 * presigned PUT URL) specifically because it lets S3 itself enforce `content-length-range`
 * and an exact `Content-Type` match as signed conditions — the size/type limits hold even if
 * the client lies, without file bytes ever passing through the Next.js server.
 */
export async function createEvidenceUploadPost(storageKey: string, mimeType: string) {
  const client = getS3Client();
  return createPresignedPost(client, {
    Bucket: getBucket(),
    Key: storageKey,
    Conditions: [
      ["content-length-range", 1, EVIDENCE_MAX_BYTES],
      ["eq", "$Content-Type", mimeType],
    ],
    Fields: { "Content-Type": mimeType },
    Expires: 60 * 5, // 5 minutes to complete the upload
  });
}

/** Verifies an object actually landed in S3 (and matches expectations) rather than trusting
 *  client-reported metadata for the DB row — defense in depth for confirmUploadAction. */
export async function headEvidenceObject(storageKey: string) {
  const client = getS3Client();
  const res = await client.send(new HeadObjectCommand({ Bucket: getBucket(), Key: storageKey }));
  return { sizeBytes: res.ContentLength ?? 0, mimeType: res.ContentType ?? "" };
}

export async function deleteEvidenceObject(storageKey: string) {
  const client = getS3Client();
  await client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: storageKey }));
}

/** Short-lived GET URL — objects are never public. */
export async function getEvidenceDownloadUrl(storageKey: string): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: storageKey });
  return getSignedUrl(client, command, { expiresIn: 60 * 5 }); // 5 minutes
}

/**
 * Upload a resume file to S3 (server-side).
 * Used by resume parser upload API.
 * Falls back to local file system in development if S3 is not configured.
 */
export async function uploadToS3(key: string, buffer: Buffer, mimeType: string): Promise<void> {
  if (isUsingLocalStorage()) {
    const storageDir = path.join(process.cwd(), ".local-storage");
    await ensureLocalStorageDir(storageDir);
    const filePath = path.join(storageDir, key.replace(/\//g, "_"));
    await fs.writeFile(filePath, buffer);
    console.log(`[DEV] Stored file locally: ${filePath}`);
    return;
  }

  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );
}

/**
 * Download a file from S3.
 * Used by resume parser worker to retrieve uploaded resumes.
 * Falls back to local file system in development if S3 is not configured.
 */
export async function downloadFromS3(key: string): Promise<Buffer> {
  if (isUsingLocalStorage()) {
    const storageDir = path.join(process.cwd(), ".local-storage");
    const filePath = path.join(storageDir, key.replace(/\//g, "_"));
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      throw new Error(`Local storage file not found: ${filePath}`);
    }
  }

  const client = getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error(`No body in S3 response for key: ${key}`);
  }

  // Convert stream to buffer
  const chunks: Buffer[] = [];
  const body = response.Body as any;

  for await (const chunk of body) {
    chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
