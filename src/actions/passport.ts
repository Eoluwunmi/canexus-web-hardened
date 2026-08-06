"use server";

import { db } from "@/db";
import { skills, userSkills, evidenceFiles } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { deleteEvidenceObject } from "@/lib/storage";

async function requireApplicant() {
  const session = await auth();
  if (!session?.user || session.user.role !== "APPLICANT") {
    throw new Error("Not authorized");
  }
  return session.user;
}

const addSkillSchema = z.object({
  skillName: z.string().min(2).max(150),
  category: z.string().min(2).max(100),
  evidence: z.string().max(2000).optional(),
  visibility: z.enum(["PRIVATE", "EMPLOYERS", "PUBLIC"]).default("EMPLOYERS"),
});

/** Adds a skill to the user's Passport, creating the taxonomy entry if it doesn't exist yet
 *  (mirrors the "new skill candidate" queue behaviour described in PRD Vol.2 — auto-approved
 *  for MVP simplicity; a real launch would route unmapped terms to admin review first). */
export async function addSkillAction(formData: FormData) {
  const user = await requireApplicant();
  const parsed = addSkillSchema.safeParse({
    skillName: formData.get("skillName"),
    category: formData.get("category"),
    evidence: formData.get("evidence") || undefined,
    visibility: formData.get("visibility") || "EMPLOYERS",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const { skillName, category, evidence, visibility } = parsed.data;

  let [skill] = await db.select().from(skills).where(ilike(skills.name, skillName)).limit(1);
  if (!skill) {
    [skill] = await db.insert(skills).values({ name: skillName, category }).returning();
  }

  const verificationLevel = evidence && evidence.trim().length > 0 ? "EVIDENCE_LINKED" : "SELF_REPORTED";

  await db
    .insert(userSkills)
    .values({ userId: user.id, skillId: skill.id, evidence, verificationLevel, visibility })
    .onConflictDoUpdate({
      target: [userSkills.userId, userSkills.skillId],
      set: { evidence, verificationLevel, visibility },
    });

  await logAudit({
    actorUserId: user.id,
    actorRole: "APPLICANT",
    action: "PASSPORT_EVIDENCE_WRITE",
    targetUserId: user.id,
    targetResource: `user_skills:${skill.id}`,
    metadata: { skillName, verificationLevel, visibility, hasEvidence: Boolean(evidence) },
  });

  revalidatePath("/dashboard/applicant/passport");
  revalidatePath("/dashboard/applicant");
}

export async function removeSkillAction(userSkillId: string) {
  const user = await requireApplicant();

  // The DB cascade (evidenceFiles.userSkillId onDelete: cascade) will remove the
  // evidence_files rows automatically, but it can't reach into S3 — clean up the underlying
  // objects first, while we still have their storage keys.
  const attachedFiles = await db.select({ storageKey: evidenceFiles.storageKey }).from(evidenceFiles).where(eq(evidenceFiles.userSkillId, userSkillId));
  await Promise.all(
    attachedFiles.map((f) =>
      deleteEvidenceObject(f.storageKey).catch((err) => console.error("[passport] failed to delete S3 object on skill removal", f.storageKey, err)),
    ),
  );

  await db.delete(userSkills).where(and(eq(userSkills.id, userSkillId), eq(userSkills.userId, user.id)));
  await logAudit({
    actorUserId: user.id,
    actorRole: "APPLICANT",
    action: "PASSPORT_EVIDENCE_DELETE",
    targetUserId: user.id,
    targetResource: `user_skills:${userSkillId}`,
    metadata: attachedFiles.length > 0 ? { deletedFileCount: attachedFiles.length } : undefined,
  });
  revalidatePath("/dashboard/applicant/passport");
  revalidatePath("/dashboard/applicant");
}

export async function updateVisibilityAction(userSkillId: string, visibility: "PRIVATE" | "EMPLOYERS" | "PUBLIC") {
  const user = await requireApplicant();
  await db
    .update(userSkills)
    .set({ visibility })
    .where(and(eq(userSkills.id, userSkillId), eq(userSkills.userId, user.id)));
  await logAudit({
    actorUserId: user.id,
    actorRole: "APPLICANT",
    action: "PASSPORT_VISIBILITY_CHANGE",
    targetUserId: user.id,
    targetResource: `user_skills:${userSkillId}`,
    metadata: { visibility },
  });
  revalidatePath("/dashboard/applicant/passport");
}
