"use server";

import { db } from "@/db";
import { userSkills, evidenceFiles, users } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import {
  validateEvidenceFile,
  buildEvidenceStorageKey,
  createEvidenceUploadPost,
  headEvidenceObject,
  deleteEvidenceObject,
  getEvidenceDownloadUrl,
  EVIDENCE_MAX_FILES_PER_SKILL,
} from "@/lib/storage";

async function requireApplicant() {
  const session = await auth();
  if (!session?.user || session.user.role !== "APPLICANT") {
    throw new Error("Not authorized");
  }
  return session.user;
}

/** A userSkills row belonging to `userId` — throws if it doesn't exist or belongs to someone else. */
async function requireOwnedUserSkill(userSkillId: string, userId: string) {
  const [row] = await db.select().from(userSkills).where(and(eq(userSkills.id, userSkillId), eq(userSkills.userId, userId))).limit(1);
  if (!row) throw new Error("Not found");
  return row;
}

/** After a file is added or removed, re-derives verificationLevel per spec: at least one file
 *  means EVIDENCE_LINKED; zero files drops back to SELF_REPORTED — unless the skill is already
 *  VERIFIED (an admin's determination outranks the automatic evidence-based level and is never
 *  silently downgraded by a file deletion). */
async function recomputeVerificationLevel(userSkillId: string) {
  const [row] = await db.select({ verificationLevel: userSkills.verificationLevel }).from(userSkills).where(eq(userSkills.id, userSkillId)).limit(1);
  if (!row || row.verificationLevel === "VERIFIED") return;

  const [{ value: fileCount }] = await db.select({ value: count() }).from(evidenceFiles).where(eq(evidenceFiles.userSkillId, userSkillId));
  const nextLevel = fileCount > 0 ? "EVIDENCE_LINKED" : "SELF_REPORTED";
  if (nextLevel !== row.verificationLevel) {
    await db.update(userSkills).set({ verificationLevel: nextLevel }).where(eq(userSkills.id, userSkillId));
  }
}

const requestUploadSchema = z.object({
  userSkillId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
});

/** Step 1 of upload: validates the request and returns a presigned POST policy the browser
 *  posts directly to S3 — file bytes never pass through this server (see src/lib/storage.ts). */
export async function requestEvidenceUploadAction(input: z.infer<typeof requestUploadSchema>) {
  const user = await requireApplicant();
  const parsed = requestUploadSchema.parse(input);
  await requireOwnedUserSkill(parsed.userSkillId, user.id);

  const validation = validateEvidenceFile(parsed.fileName, parsed.mimeType, parsed.sizeBytes);
  if (!validation.ok) throw new Error(validation.error);

  const [{ value: fileCount }] = await db.select({ value: count() }).from(evidenceFiles).where(eq(evidenceFiles.userSkillId, parsed.userSkillId));
  if (fileCount >= EVIDENCE_MAX_FILES_PER_SKILL) {
    throw new Error(`A skill can have at most ${EVIDENCE_MAX_FILES_PER_SKILL} attached files.`);
  }

  const storageKey = buildEvidenceStorageKey(user.id, parsed.userSkillId, parsed.fileName);
  const post = await createEvidenceUploadPost(storageKey, parsed.mimeType);

  return { post, storageKey };
}

const confirmUploadSchema = z.object({
  userSkillId: z.string().uuid(),
  storageKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
});

/** Step 2 of upload: called by the client after the direct-to-S3 POST succeeds. Re-verifies
 *  the object against S3 itself via HeadObject rather than trusting client-reported size/type
 *  a second time — defense in depth, since the request in step 1 only validated *intent*. */
export async function confirmEvidenceUploadAction(input: z.infer<typeof confirmUploadSchema>) {
  const user = await requireApplicant();
  const parsed = confirmUploadSchema.parse(input);
  await requireOwnedUserSkill(parsed.userSkillId, user.id);

  // Belt-and-braces: the storage key must actually be scoped under this user + userSkill,
  // not just any key the client happens to send us.
  if (!parsed.storageKey.startsWith(`evidence/${user.id}/${parsed.userSkillId}/`)) {
    throw new Error("Invalid storage key");
  }

  const { sizeBytes, mimeType } = await headEvidenceObject(parsed.storageKey);
  const validation = validateEvidenceFile(parsed.fileName, mimeType, sizeBytes);
  if (!validation.ok) {
    // The object made it to S3 but doesn't actually satisfy our rules (shouldn't normally
    // happen given the policy conditions, but don't trust that blindly) — clean it up.
    await deleteEvidenceObject(parsed.storageKey).catch(() => {});
    throw new Error(validation.error);
  }

  const [{ value: fileCount }] = await db.select({ value: count() }).from(evidenceFiles).where(eq(evidenceFiles.userSkillId, parsed.userSkillId));
  if (fileCount >= EVIDENCE_MAX_FILES_PER_SKILL) {
    await deleteEvidenceObject(parsed.storageKey).catch(() => {});
    throw new Error(`A skill can have at most ${EVIDENCE_MAX_FILES_PER_SKILL} attached files.`);
  }

  const [file] = await db
    .insert(evidenceFiles)
    .values({ userSkillId: parsed.userSkillId, fileName: parsed.fileName, storageKey: parsed.storageKey, mimeType, sizeBytes })
    .returning();

  await recomputeVerificationLevel(parsed.userSkillId);

  await logAudit({
    actorUserId: user.id,
    actorRole: "APPLICANT",
    action: "EVIDENCE_FILE_UPLOAD",
    targetUserId: user.id,
    targetResource: `evidence_files:${file.id}`,
    metadata: { userSkillId: parsed.userSkillId, fileName: parsed.fileName, mimeType, sizeBytes },
  });

  revalidatePath("/dashboard/applicant/passport");
  return { id: file.id };
}

export async function deleteEvidenceFileAction(fileId: string) {
  const user = await requireApplicant();

  const [row] = await db
    .select({ id: evidenceFiles.id, userSkillId: evidenceFiles.userSkillId, storageKey: evidenceFiles.storageKey, ownerUserId: userSkills.userId })
    .from(evidenceFiles)
    .innerJoin(userSkills, eq(userSkills.id, evidenceFiles.userSkillId))
    .where(eq(evidenceFiles.id, fileId))
    .limit(1);
  if (!row || row.ownerUserId !== user.id) throw new Error("Not found");

  await deleteEvidenceObject(row.storageKey).catch((err) => {
    // Log and continue: an orphaned S3 object is a cleanup annoyance, but leaving a dangling
    // DB row the user can't get rid of (because deletion "failed") is worse UX and a data
    // integrity problem. Flagged here for operator visibility.
    console.error("[evidence] failed to delete S3 object", row.storageKey, err);
  });
  await db.delete(evidenceFiles).where(eq(evidenceFiles.id, fileId));
  await recomputeVerificationLevel(row.userSkillId);

  await logAudit({
    actorUserId: user.id,
    actorRole: "APPLICANT",
    action: "EVIDENCE_FILE_DELETE",
    targetUserId: user.id,
    targetResource: `evidence_files:${fileId}`,
    metadata: { userSkillId: row.userSkillId },
  });

  revalidatePath("/dashboard/applicant/passport");
}

/** Owning applicant or ADMIN only — employers have no code path to this at all (no action,
 *  no query) in this iteration, per spec. */
export async function getEvidenceDownloadUrlAction(fileId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authorized");

  const [row] = await db
    .select({ storageKey: evidenceFiles.storageKey, fileName: evidenceFiles.fileName, ownerUserId: userSkills.userId })
    .from(evidenceFiles)
    .innerJoin(userSkills, eq(userSkills.id, evidenceFiles.userSkillId))
    .where(eq(evidenceFiles.id, fileId))
    .limit(1);
  if (!row) throw new Error("Not found");

  const [actor] = await db.select({ role: users.role }).from(users).where(eq(users.id, session.user.id)).limit(1);
  const isOwner = row.ownerUserId === session.user.id;
  const isAdmin = actor?.role === "ADMIN";
  if (!isOwner && !isAdmin) throw new Error("Not authorized");

  const url = await getEvidenceDownloadUrl(row.storageKey);

  await logAudit({
    actorUserId: session.user.id,
    actorRole: actor?.role ?? null,
    action: "EVIDENCE_DOWNLOAD_URL_GENERATED",
    targetUserId: row.ownerUserId,
    targetResource: `evidence_files:${fileId}`,
    metadata: { asAdmin: isAdmin && !isOwner },
  });

  return { url, fileName: row.fileName };
}

/** Read-only listing for a userSkill's attached files — used by both the applicant's own
 *  Passport page and the admin verification queue, hence the owner-or-admin check here too. */
export async function listEvidenceFilesAction(userSkillId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authorized");

  const [owned] = await db.select({ userId: userSkills.userId }).from(userSkills).where(eq(userSkills.id, userSkillId)).limit(1);
  if (!owned) return [];

  const [actor] = await db.select({ role: users.role }).from(users).where(eq(users.id, session.user.id)).limit(1);
  const isOwner = owned.userId === session.user.id;
  const isAdmin = actor?.role === "ADMIN";
  if (!isOwner && !isAdmin) throw new Error("Not authorized");

  return db
    .select({ id: evidenceFiles.id, fileName: evidenceFiles.fileName, mimeType: evidenceFiles.mimeType, sizeBytes: evidenceFiles.sizeBytes, uploadedAt: evidenceFiles.uploadedAt })
    .from(evidenceFiles)
    .where(eq(evidenceFiles.userSkillId, userSkillId));
}
