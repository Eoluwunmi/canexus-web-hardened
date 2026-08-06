"use server";

import { db } from "@/db";
import { userConsents, applications, jobs, employers } from "@/db/schema";
import { auth } from "@/auth";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Not authorized");
  return session.user;
}

const consentTypeSchema = z.enum(["FUNCTIONAL_USE", "EMPLOYER_VISIBILITY", "AI_PROCESSING", "MARKETING"]);

const CONSENT_VERSION = 1;

/**
 * Grants (or re-grants) a consent. EMPLOYER_VISIBILITY must be scoped to a specific employer —
 * there is intentionally no global "visible to all employers" grant, per Volume 8.5 / PIPEDA's
 * requirement that consent be specific to the purpose and recipient, not a blanket toggle.
 */
export async function grantConsentAction(consentType: string, employerId?: string) {
  const user = await requireUser();
  const parsedType = consentTypeSchema.parse(consentType);
  if (parsedType === "EMPLOYER_VISIBILITY" && !employerId) {
    throw new Error("EMPLOYER_VISIBILITY consent must be scoped to a specific employer");
  }

  await db.insert(userConsents).values({
    userId: user.id,
    consentType: parsedType,
    employerId: parsedType === "EMPLOYER_VISIBILITY" ? employerId : null,
    granted: true,
    version: CONSENT_VERSION,
  });

  await logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: "CONSENT_GRANT",
    targetUserId: user.id,
    targetResource: employerId ? `consent:${parsedType}:employer:${employerId}` : `consent:${parsedType}`,
    metadata: { consentType: parsedType, employerId: employerId ?? null, version: CONSENT_VERSION },
  });

  revalidatePath("/dashboard/applicant/settings");
}

export async function revokeConsentAction(consentType: string, employerId?: string) {
  const user = await requireUser();
  const parsedType = consentTypeSchema.parse(consentType);

  await db.insert(userConsents).values({
    userId: user.id,
    consentType: parsedType,
    employerId: parsedType === "EMPLOYER_VISIBILITY" ? (employerId ?? null) : null,
    granted: false,
    version: CONSENT_VERSION,
  });

  await logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: "CONSENT_REVOKE",
    targetUserId: user.id,
    targetResource: employerId ? `consent:${parsedType}:employer:${employerId}` : `consent:${parsedType}`,
    metadata: { consentType: parsedType, employerId: employerId ?? null, version: CONSENT_VERSION },
  });

  revalidatePath("/dashboard/applicant/settings");
}

export type ConsentState = {
  consentType: "FUNCTIONAL_USE" | "EMPLOYER_VISIBILITY" | "AI_PROCESSING" | "MARKETING";
  employerId: string | null;
  employerName?: string | null;
  granted: boolean;
  version: number;
  updatedAt: Date;
};

/**
 * Consent is stored as an append-only event log (each grant/revoke is a new row), not a single
 * mutable row — that keeps the full consent history auditable. This reads back the *current*
 * state: the most recent row per (consentType, employerId) pair.
 */
export async function getConsentsForUser(userId?: string): Promise<ConsentState[]> {
  const user = await requireUser();
  const targetId = userId ?? user.id;
  if (targetId !== user.id && user.role !== "ADMIN") throw new Error("Not authorized");

  const rows = await db
    .select({
      consentType: userConsents.consentType,
      employerId: userConsents.employerId,
      employerName: employers.orgName,
      granted: userConsents.granted,
      version: userConsents.version,
      createdAt: userConsents.createdAt,
    })
    .from(userConsents)
    .leftJoin(employers, eq(employers.id, userConsents.employerId))
    .where(eq(userConsents.userId, targetId))
    .orderBy(desc(userConsents.createdAt));

  const latest = new Map<string, ConsentState>();
  for (const r of rows) {
    const key = `${r.consentType}:${r.employerId ?? "global"}`;
    if (!latest.has(key)) {
      latest.set(key, {
        consentType: r.consentType,
        employerId: r.employerId,
        employerName: r.employerName,
        granted: r.granted,
        version: r.version,
        updatedAt: r.createdAt,
      });
    }
  }
  return Array.from(latest.values());
}

/** Employers a user has an application with — used to render the per-employer
 *  EMPLOYER_VISIBILITY consent list, since that consent must be scoped per employer
 *  rather than being a single global toggle. */
export async function getEmployersWithActiveApplication(userId: string) {
  const rows = await db
    .select({ employerId: employers.id, employerName: employers.orgName, jobTitle: jobs.title })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(employers, eq(employers.id, jobs.employerId))
    .where(eq(applications.userId, userId));

  // De-dupe by employer (a user may have applied to multiple jobs at the same employer).
  const byEmployer = new Map<string, { employerId: string; employerName: string; jobTitle: string }>();
  for (const r of rows) if (!byEmployer.has(r.employerId)) byEmployer.set(r.employerId, r);
  return Array.from(byEmployer.values());
}
