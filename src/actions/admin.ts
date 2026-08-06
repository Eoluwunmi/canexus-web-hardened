"use server";

import { db } from "@/db";
import { userSkills, skills, users, evidenceFiles } from "@/db/schema";
import { auth } from "@/auth";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Not authorized");
  }
  return session.user;
}

/**
 * Admin skill verification. The MVP shipped without an admin verification workflow — the
 * `VERIFIED` level in `verificationEnum` existed in the schema but nothing could ever set it.
 * This is the first real implementation of that action (Volume 8 names "ADMIN_VERIFY_SKILL"
 * as an example audited action, so it's implemented for real here rather than left as a
 * no-op placeholder). Every call is audited, per Volume 8 append-only logging requirements.
 */
export async function adminVerifySkillAction(userSkillId: string) {
  const admin = await requireAdmin();

  const [row] = await db
    .select({ id: userSkills.id, userId: userSkills.userId, skillName: skills.name })
    .from(userSkills)
    .innerJoin(skills, eq(skills.id, userSkills.skillId))
    .where(eq(userSkills.id, userSkillId))
    .limit(1);
  if (!row) throw new Error("Skill entry not found");

  await db.update(userSkills).set({ verificationLevel: "VERIFIED" }).where(eq(userSkills.id, userSkillId));

  await logAudit({
    actorUserId: admin.id,
    actorRole: "ADMIN",
    action: "ADMIN_VERIFY_SKILL",
    targetUserId: row.userId,
    targetResource: `user_skills:${userSkillId}`,
    metadata: { skillName: row.skillName },
  });

  revalidatePath("/dashboard/admin/verification");
}

/** Read-only: skills currently sitting at EVIDENCE_LINKED, awaiting an admin's VERIFIED decision.
 *  Includes each pending skill's attached evidence files so a reviewer can open them before
 *  deciding — files are fetched via getEvidenceDownloadUrlAction client-side (short-lived
 *  presigned URLs are generated on demand, never stored or exposed directly here). */
export async function getPendingVerifications() {
  await requireAdmin();
  const pending = await db
    .select({
      id: userSkills.id,
      skillName: skills.name,
      evidence: userSkills.evidence,
      applicantName: users.name,
      applicantEmail: users.email,
      createdAt: userSkills.createdAt,
    })
    .from(userSkills)
    .innerJoin(skills, eq(skills.id, userSkills.skillId))
    .innerJoin(users, eq(users.id, userSkills.userId))
    .where(eq(userSkills.verificationLevel, "EVIDENCE_LINKED"));

  if (pending.length === 0) return pending.map((p) => ({ ...p, files: [] as { id: string; fileName: string; sizeBytes: number }[] }));

  const files = await db
    .select({ id: evidenceFiles.id, userSkillId: evidenceFiles.userSkillId, fileName: evidenceFiles.fileName, sizeBytes: evidenceFiles.sizeBytes })
    .from(evidenceFiles)
    .where(inArray(evidenceFiles.userSkillId, pending.map((p) => p.id)));

  return pending.map((p) => ({ ...p, files: files.filter((f) => f.userSkillId === p.id) }));
}
