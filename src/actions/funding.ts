"use server";

import { db } from "@/db";
import { fundingIncentives } from "@/db/schema";
import { auth } from "@/auth";
import { eq, and, or, desc, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Not authorized");
  }
  return session.user;
}

const incentiveSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(3000),
  incentiveType: z.enum(["WAGE_SUBSIDY", "GRANT", "SCHOLARSHIP", "TAX_CREDIT", "BURSARY"]),
  audience: z.enum(["APPLICANT", "EMPLOYER", "BOTH"]),
  jurisdiction: z.string().min(2).max(100),
  amountDescription: z.string().min(1).max(300),
  eligibilitySummary: z.string().min(10).max(3000),
  sourceUrl: z.string().url().max(2000),
  applicationDeadline: z.string().optional(), // yyyy-mm-dd
});

function parseIncentiveForm(formData: FormData) {
  return incentiveSchema.parse({
    title: formData.get("title"),
    description: formData.get("description"),
    incentiveType: formData.get("incentiveType"),
    audience: formData.get("audience"),
    jurisdiction: formData.get("jurisdiction"),
    amountDescription: formData.get("amountDescription"),
    eligibilitySummary: formData.get("eligibilitySummary"),
    sourceUrl: formData.get("sourceUrl"),
    applicationDeadline: formData.get("applicationDeadline") || undefined,
  });
}

export async function createFundingIncentiveAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = parseIncentiveForm(formData);

  const [row] = await db
    .insert(fundingIncentives)
    .values({ ...parsed, applicationDeadline: parsed.applicationDeadline ? new Date(parsed.applicationDeadline) : undefined })
    .returning();

  await logAudit({
    actorUserId: admin.id,
    actorRole: "ADMIN",
    action: "FUNDING_INCENTIVE_CREATE",
    targetResource: `funding_incentives:${row.id}`,
    metadata: { title: row.title, audience: row.audience, incentiveType: row.incentiveType },
  });

  revalidatePath("/dashboard/admin/funding");
  revalidatePath("/dashboard/applicant/funding");
  revalidatePath("/dashboard/employer/funding");
}

export async function updateFundingIncentiveAction(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const parsed = parseIncentiveForm(formData);

  await db
    .update(fundingIncentives)
    .set({ ...parsed, applicationDeadline: parsed.applicationDeadline ? new Date(parsed.applicationDeadline) : null, updatedAt: new Date() })
    .where(eq(fundingIncentives.id, id));

  await logAudit({
    actorUserId: admin.id,
    actorRole: "ADMIN",
    action: "FUNDING_INCENTIVE_UPDATE",
    targetResource: `funding_incentives:${id}`,
    metadata: { title: parsed.title, audience: parsed.audience, incentiveType: parsed.incentiveType },
  });

  revalidatePath("/dashboard/admin/funding");
  revalidatePath("/dashboard/applicant/funding");
  revalidatePath("/dashboard/employer/funding");
}

/** No hard delete, by design (see schema comment) — deactivation is the only way to remove an
 *  incentive from the public-facing views. The row and its full edit history stay intact. */
export async function deactivateFundingIncentiveAction(id: string) {
  const admin = await requireAdmin();
  await db.update(fundingIncentives).set({ isActive: false, updatedAt: new Date() }).where(eq(fundingIncentives.id, id));

  await logAudit({
    actorUserId: admin.id,
    actorRole: "ADMIN",
    action: "FUNDING_INCENTIVE_DEACTIVATE",
    targetResource: `funding_incentives:${id}`,
  });

  revalidatePath("/dashboard/admin/funding");
  revalidatePath("/dashboard/applicant/funding");
  revalidatePath("/dashboard/employer/funding");
}

export async function getFundingIncentiveById(id: string) {
  await requireAdmin();
  const [row] = await db.select().from(fundingIncentives).where(eq(fundingIncentives.id, id)).limit(1);
  return row ?? null;
}

/** All incentives, active and inactive — admin management view only. */
export async function getAllFundingIncentivesForAdmin() {
  await requireAdmin();
  return db.select().from(fundingIncentives).orderBy(desc(fundingIncentives.createdAt));
}

export type FundingFilters = { jurisdiction?: string; incentiveType?: string };

/** Audience-filtered, active-only read for the applicant/employer-facing views. Sorted
 *  expiring-soonest-first; incentives with no deadline sort last (nothing to expire). */
async function getFundingIncentivesForAudience(audience: "APPLICANT" | "EMPLOYER", filters: FundingFilters) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authorized");

  const conditions = [eq(fundingIncentives.isActive, true), or(eq(fundingIncentives.audience, audience), eq(fundingIncentives.audience, "BOTH"))];
  if (filters.jurisdiction) conditions.push(eq(fundingIncentives.jurisdiction, filters.jurisdiction));
  if (filters.incentiveType) conditions.push(eq(fundingIncentives.incentiveType, filters.incentiveType as "WAGE_SUBSIDY" | "GRANT" | "SCHOLARSHIP" | "TAX_CREDIT" | "BURSARY"));

  const rows = await db
    .select()
    .from(fundingIncentives)
    .where(and(...conditions))
    .orderBy(asc(fundingIncentives.applicationDeadline));

  // Drizzle's asc() puts NULLs first in Postgres by default — we want them last (nothing to
  // expire sorts after everything that does), so re-sort in JS rather than fight the SQL NULLS
  // ordering clause for one query.
  return rows.sort((a, b) => {
    if (!a.applicationDeadline && !b.applicationDeadline) return 0;
    if (!a.applicationDeadline) return 1;
    if (!b.applicationDeadline) return -1;
    return a.applicationDeadline.getTime() - b.applicationDeadline.getTime();
  });
}

export async function getApplicantFundingIncentives(filters: FundingFilters) {
  return getFundingIncentivesForAudience("APPLICANT", filters);
}

export async function getEmployerFundingIncentives(filters: FundingFilters) {
  return getFundingIncentivesForAudience("EMPLOYER", filters);
}
