import { auth } from "@/auth";
import { db } from "@/db";
import { employers, jobs, applications, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateApplicationStatusAction, closeJobAction } from "@/actions/jobs";

export default async function EmployerOverview() {
  const session = await auth();
  const [employer] = await db.select().from(employers).where(eq(employers.ownerUserId, session!.user.id)).limit(1);

  const myJobs = employer ? await db.select().from(jobs).where(eq(jobs.employerId, employer.id)) : [];

  const jobsWithApps = await Promise.all(
    myJobs.map(async (job) => {
      const apps = await db
        .select({ id: applications.id, status: applications.status, matchScore: applications.matchScore, name: users.name })
        .from(applications)
        .innerJoin(users, eq(users.id, applications.userId))
        .where(eq(applications.jobId, job.id));
      return { job, apps };
    }),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">{employer?.orgName}</h1>
        <p className="text-ink-soft mt-1">Your postings and pipeline.</p>
      </div>

      {jobsWithApps.length === 0 ? (
        <p className="text-ink-soft text-sm">You haven&apos;t posted any roles yet.</p>
      ) : (
        <div className="space-y-6">
          {jobsWithApps.map(({ job, apps }) => (
            <div key={job.id} className="paper-card rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">{job.title}</h2>
                  <p className="text-xs font-mono uppercase text-ink-soft">{job.status} · {apps.length} applicant{apps.length === 1 ? "" : "s"}</p>
                </div>
                {job.status === "OPEN" && (
                  <form action={closeJobAction.bind(null, job.id)}>
                    <button className="text-xs text-stamp font-medium hover:underline">Close posting</button>
                  </form>
                )}
              </div>
              {apps.length > 0 && (
                <ul className="mt-4 divide-y divide-paper-dim">
                  {apps.map((a) => (
                    <li key={a.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-ink">{a.name}</span>
                        {a.matchScore != null && <span className="ml-2 text-xs font-mono text-verified">{Math.round(a.matchScore * 100)}% match</span>}
                      </div>
                      <form
                        action={async (formData: FormData) => {
                          "use server";
                          await updateApplicationStatusAction(
                            a.id,
                            formData.get("status") as "REVIEWING" | "INTERVIEW" | "OFFER" | "REJECTED",
                          );
                        }}
                        className="flex items-center gap-2"
                      >
                        <select name="status" defaultValue={a.status} className="text-xs rounded-md border border-paper-dim bg-cream px-2 py-1">
                          <option value="SUBMITTED">Submitted</option>
                          <option value="REVIEWING">Reviewing</option>
                          <option value="INTERVIEW">Interview</option>
                          <option value="OFFER">Offer</option>
                          <option value="REJECTED">Rejected</option>
                        </select>
                        <button type="submit" className="text-xs text-stamp font-medium hover:underline">Update</button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
