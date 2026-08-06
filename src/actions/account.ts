"use server";

import { db } from "@/db";
import { users, userSkills, skills, applications, jobs, mentorSessions, mentorProfiles, erasureRequests } from "@/db/schema";
import { auth, signOut } from "@/auth";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Not authorized");
  return session.user;
}

/**
 * Right to access (PIPEDA / Volume 8): compiles the user's profile, skills, applications, and
 * mentor sessions into a single JSON export. Returned as a plain object here; the settings page
 * turns it into a downloadable file client-side (see the "Download my data" form).
 */
export async function exportUserDataAction() {
  const user = await requireUser();

  const [profile] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, location: users.location, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const mySkills = await db
    .select({ skillName: skills.name, category: skills.category, evidence: userSkills.evidence, verificationLevel: userSkills.verificationLevel, visibility: userSkills.visibility, createdAt: userSkills.createdAt })
    .from(userSkills)
    .innerJoin(skills, eq(skills.id, userSkills.skillId))
    .where(eq(userSkills.userId, user.id));

  const myApplications = await db
    .select({ jobTitle: jobs.title, status: applications.status, coverNote: applications.coverNote, matchScore: applications.matchScore, createdAt: applications.createdAt })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(applications.userId, user.id));

  // A user can be a mentee (mentorSessions.menteeUserId) and/or a mentor (via mentorProfiles).
  const asMentee = await db
    .select({ scheduledAt: mentorSessions.scheduledAt, status: mentorSessions.status, notes: mentorSessions.notes })
    .from(mentorSessions)
    .where(eq(mentorSessions.menteeUserId, user.id));

  const [mentorProfile] = await db.select().from(mentorProfiles).where(eq(mentorProfiles.userId, user.id)).limit(1);
  const asMentor = mentorProfile
    ? await db
        .select({ scheduledAt: mentorSessions.scheduledAt, status: mentorSessions.status, notes: mentorSessions.notes })
        .from(mentorSessions)
        .where(eq(mentorSessions.mentorId, mentorProfile.id))
    : [];

  await logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: "DATA_EXPORT",
    targetUserId: user.id,
    targetResource: `user:${user.id}`,
  });

  return {
    exportedAt: new Date().toISOString(),
    profile,
    skills: mySkills,
    applications: myApplications,
    mentorSessions: { asMentee, asMentor },
  };
}

/**
 * Soft delete (Volume 6.3): flips `status` to DELETED rather than removing the row, preserving
 * referential integrity for Applications/Sessions history. The user is signed out immediately;
 * src/auth.ts's `authorize` callback also blocks any future login for a non-ACTIVE user, and
 * src/lib/matching.ts excludes DELETED users from employer candidate search.
 */
export async function deleteAccountAction() {
  const user = await requireUser();

  await db.update(users).set({ status: "DELETED" }).where(eq(users.id, user.id));

  await logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: "ACCOUNT_SOFT_DELETE",
    targetUserId: user.id,
    targetResource: `user:${user.id}`,
  });

  await signOut({ redirectTo: "/" });
}

/**
 * Distinct from soft delete above: creates an admin-reviewable request for actual hard
 * deletion. Hard deletion itself is intentionally NOT performed here — it needs to cascade
 * correctly across every table referencing this user and be reviewed before it's irreversible.
 */
export async function requestErasureAction() {
  const user = await requireUser();

  await db.insert(erasureRequests).values({ userId: user.id, status: "REQUESTED" });

  await logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: "ERASURE_REQUEST",
    targetUserId: user.id,
    targetResource: `user:${user.id}`,
  });
}

/**
 * Right to correction, partial: name and location are user-editable here. Email is NOT
 * user-editable in this MVP — it doubles as the login identifier, and changing it needs a
 * re-verification flow (confirm-new-address, etc.) that doesn't exist yet. Flagged as a gap
 * for a follow-up ticket; until then, an email correction has to go through support/an admin.
 */
export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  if (name.length < 2) throw new Error("Name must be at least 2 characters");

  await db.update(users).set({ name, location: location || null }).where(eq(users.id, user.id));

  await logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: "PROFILE_CORRECTION",
    targetUserId: user.id,
    targetResource: `user:${user.id}`,
  });
}
