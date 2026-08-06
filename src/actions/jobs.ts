"use server";

import { db } from "@/db";
import { jobs, jobSkills, skills, employers, applications } from "@/db/schema";
import { auth } from "@/auth";
import { eq, and, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function requireEmployer() {
  const session = await auth();
  if (!session?.user || session.user.role !== "EMPLOYER") throw new Error("Not authorized");
  const [employer] = await db.select().from(employers).where(eq(employers.ownerUserId, session.user.id)).limit(1);
  if (!employer) throw new Error("No employer organization found for this account");
  return { user: session.user, employer };
}

const createJobSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  location: z.string().max(200).optional(),
  requiredSkills: z.string(), // comma-separated
  preferredSkills: z.string().optional(),
  opportunityType: z.enum(["JOB", "CO_OP", "INTERNSHIP", "MICRO_INTERNSHIP", "APPRENTICESHIP", "PRACTICUM"]).default("JOB"),
  durationWeeks: z.coerce.number().int().positive().max(260).optional(),
  isCreditEligible: z.boolean().default(false),
  estimatedHoursPerWeek: z.coerce.number().int().positive().max(168).optional(),
  applicationDeadline: z.string().optional(), // yyyy-mm-dd from <input type="date">
  isPaid: z.enum(["true", "false"]).optional().transform((v) => (v === undefined ? undefined : v === "true")),
});

export async function createJobAction(formData: FormData) {
  const { employer } = await requireEmployer();
  const parsed = createJobSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    location: formData.get("location") || undefined,
    requiredSkills: formData.get("requiredSkills") || "",
    preferredSkills: formData.get("preferredSkills") || "",
    opportunityType: formData.get("opportunityType") || "JOB",
    durationWeeks: formData.get("durationWeeks") || undefined,
    isCreditEligible: formData.get("isCreditEligible") === "on",
    estimatedHoursPerWeek: formData.get("estimatedHoursPerWeek") || undefined,
    applicationDeadline: formData.get("applicationDeadline") || undefined,
    isPaid: formData.get("isPaid") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid job posting");
  const {
    title, description, location, requiredSkills, preferredSkills,
    opportunityType, durationWeeks, isCreditEligible, estimatedHoursPerWeek, applicationDeadline, isPaid,
  } = parsed.data;

  // Duration/credit-eligibility are conceptually tied to work-integrated-learning placements,
  // not plain JOB postings — the UI only shows those fields for non-JOB types, and this is the
  // server-side mirror of that so a crafted request can't set them on a plain job either.
  const isWorkIntegratedLearning = opportunityType !== "JOB";

  const [job] = await db
    .insert(jobs)
    .values({
      employerId: employer.id,
      title,
      description,
      location,
      status: "OPEN",
      opportunityType,
      durationWeeks: isWorkIntegratedLearning ? durationWeeks : undefined,
      isCreditEligible: isWorkIntegratedLearning ? isCreditEligible : false,
      estimatedHoursPerWeek,
      applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : undefined,
      isPaid,
    })
    .returning();

  async function attachSkills(list: string, type: "REQUIRED" | "PREFERRED") {
    const names = list.split(",").map((s) => s.trim()).filter(Boolean);
    for (const name of names) {
      let [skill] = await db.select().from(skills).where(ilike(skills.name, name)).limit(1);
      if (!skill) [skill] = await db.insert(skills).values({ name, category: "General" }).returning();
      await db.insert(jobSkills).values({ jobId: job.id, skillId: skill.id, requirementType: type }).onConflictDoNothing();
    }
  }
  await attachSkills(requiredSkills, "REQUIRED");
  if (preferredSkills) await attachSkills(preferredSkills, "PREFERRED");

  revalidatePath("/dashboard/employer");
  revalidatePath("/dashboard/applicant/jobs");
}

export async function closeJobAction(jobId: string) {
  const { employer } = await requireEmployer();
  await db.update(jobs).set({ status: "CLOSED" }).where(and(eq(jobs.id, jobId), eq(jobs.employerId, employer.id)));
  revalidatePath("/dashboard/employer");
}

export async function applyToJobAction(jobId: string, coverNote: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "APPLICANT") throw new Error("Not authorized");

  // Ground the match score in the same explainable engine used for occupation matching (Volume 4).
  const { jobSkills: js } = await import("@/db/schema");
  const required = await db
    .select({ skillId: js.skillId })
    .from(js)
    .where(eq(js.jobId, jobId));
  const { userSkills } = await import("@/db/schema");
  const held = await db.select({ skillId: userSkills.skillId }).from(userSkills).where(eq(userSkills.userId, session.user.id));
  const heldSet = new Set(held.map((h) => h.skillId));
  const matchScore = required.length > 0 ? required.filter((r) => heldSet.has(r.skillId)).length / required.length : 0.5;

  await db
    .insert(applications)
    .values({ jobId, userId: session.user.id, coverNote, matchScore, status: "SUBMITTED" })
    .onConflictDoNothing();

  revalidatePath("/dashboard/applicant/jobs");
  revalidatePath("/dashboard/employer");
}

export async function updateApplicationStatusAction(applicationId: string, status: "REVIEWING" | "INTERVIEW" | "OFFER" | "REJECTED") {
  await requireEmployer();
  await db.update(applications).set({ status }).where(eq(applications.id, applicationId));
  revalidatePath("/dashboard/employer");
}
