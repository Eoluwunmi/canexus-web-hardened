import { auth } from "@/auth";
import { db } from "@/db";
import { jobs, employers, applications } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { applyToJobAction } from "@/actions/jobs";
import OpportunityTypeBadge from "@/components/OpportunityTypeBadge";

const OPPORTUNITY_TYPES = ["JOB", "CO_OP", "INTERNSHIP", "MICRO_INTERNSHIP", "APPRENTICESHIP", "PRACTICUM"] as const;
const TYPE_LABELS: Record<string, string> = {
  JOB: "Job",
  CO_OP: "Co-op",
  INTERNSHIP: "Internship",
  MICRO_INTERNSHIP: "Micro-internship",
  APPRENTICESHIP: "Apprenticeship",
  PRACTICUM: "Practicum",
};

export default async function ApplicantJobsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const session = await auth();
  const userId = session!.user.id;
  const { type } = await searchParams;
  const activeType = type && (OPPORTUNITY_TYPES as readonly string[]).includes(type) ? type : undefined;

  const openJobs = await db
    .select({
      id: jobs.id, title: jobs.title, description: jobs.description, location: jobs.location, orgName: employers.orgName,
      opportunityType: jobs.opportunityType, durationWeeks: jobs.durationWeeks, isCreditEligible: jobs.isCreditEligible,
      estimatedHoursPerWeek: jobs.estimatedHoursPerWeek, applicationDeadline: jobs.applicationDeadline, isPaid: jobs.isPaid,
    })
    .from(jobs)
    .innerJoin(employers, eq(employers.id, jobs.employerId))
    .where(activeType ? and(eq(jobs.status, "OPEN"), eq(jobs.opportunityType, activeType as typeof OPPORTUNITY_TYPES[number])) : eq(jobs.status, "OPEN"));

  const myApplications = await db.select({ jobId: applications.jobId }).from(applications).where(eq(applications.userId, userId));
  const appliedSet = new Set(myApplications.map((a) => a.jobId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Open roles</h1>
        <p className="text-ink-soft mt-1">Skills-matched postings from CANexus employers.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href="/dashboard/applicant/jobs" className={`text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-full border ${!activeType ? "bg-ink text-cream border-ink" : "border-paper-dim text-ink-soft hover:border-stamp"}`}>
          All
        </a>
        {OPPORTUNITY_TYPES.map((t) => (
          <a key={t} href={`/dashboard/applicant/jobs?type=${t}`} className={`text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-full border ${activeType === t ? "bg-ink text-cream border-ink" : "border-paper-dim text-ink-soft hover:border-stamp"}`}>
            {TYPE_LABELS[t]}
          </a>
        ))}
      </div>

      {openJobs.length === 0 ? (
        <p className="text-ink-soft text-sm">No open roles{activeType ? ` of type "${TYPE_LABELS[activeType]}"` : ""} yet — check back soon.</p>
      ) : (
        <div className="space-y-4">
          {openJobs.map((job) => {
            const deadlinePassed = job.applicationDeadline ? new Date(job.applicationDeadline) < new Date() : false;
            return (
              <div key={job.id} className={`paper-card rounded-lg p-6 ${job.opportunityType === "MICRO_INTERNSHIP" ? "border-2 border-brass" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h2 className="font-display text-lg font-semibold text-ink">{job.title}</h2>
                      <OpportunityTypeBadge type={job.opportunityType} />
                    </div>
                    <p className="text-sm text-ink-soft">{job.orgName} {job.location ? `· ${job.location}` : ""}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-ink-soft font-mono">
                      {job.durationWeeks && <span>{job.durationWeeks} weeks</span>}
                      {job.isCreditEligible && <span>Credit-eligible</span>}
                      {job.estimatedHoursPerWeek && <span>~{job.estimatedHoursPerWeek} hrs/week</span>}
                      {job.isPaid !== null && <span>{job.isPaid ? "Paid" : "Unpaid"}</span>}
                      {job.applicationDeadline && (
                        <span className={deadlinePassed ? "text-stamp" : ""}>
                          {deadlinePassed ? "Deadline passed: " : "Apply by "}
                          {new Date(job.applicationDeadline).toLocaleDateString("en-CA")}
                        </span>
                      )}
                    </div>
                  </div>
                  {appliedSet.has(job.id) ? (
                    <span className="text-xs font-mono uppercase text-verified shrink-0">Applied</span>
                  ) : (
                    <form action={async (formData: FormData) => {
                      "use server";
                      await applyToJobAction(job.id, (formData.get("coverNote") as string) || "");
                    }} className="shrink-0 flex items-center gap-2">
                      <button type="submit" className="rounded-md bg-stamp text-cream px-4 py-2 text-sm font-medium hover:opacity-90">
                        Apply
                      </button>
                    </form>
                  )}
                </div>
                <p className="text-sm text-ink-soft mt-3">{job.description}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
