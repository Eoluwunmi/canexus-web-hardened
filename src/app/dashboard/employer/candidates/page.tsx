import { db } from "@/db";
import { employers, jobs } from "@/db/schema";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { matchCandidatesForJob } from "@/lib/matching";
import { logAudit } from "@/lib/audit";

export default async function CandidateSearchPage({ searchParams }: { searchParams: Promise<{ jobId?: string }> }) {
  const session = await auth();
  const [employer] = await db.select().from(employers).where(eq(employers.ownerUserId, session!.user.id)).limit(1);
  const myJobs = employer ? await db.select().from(jobs).where(eq(jobs.employerId, employer.id)) : [];

  const { jobId } = await searchParams;
  const selectedJobId = jobId || myJobs[0]?.id;
  const matches = selectedJobId ? await matchCandidatesForJob(selectedJobId) : [];
  const selectedJob = myJobs.find((j) => j.id === selectedJobId);

  // Volume 8: every employer view of applicant Skills Passport data must be audited.
  // Logged once per page load with the full candidate set shown, rather than per row,
  // to keep this proportionate while still capturing who saw which candidates' evidence when.
  if (selectedJobId && matches.length > 0) {
    await logAudit({
      actorUserId: session!.user.id,
      actorRole: "EMPLOYER",
      action: "EMPLOYER_VIEW_CANDIDATE",
      targetResource: `job:${selectedJobId}`,
      metadata: { candidateUserIds: matches.map((m) => m.userId), matchCount: matches.length },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Candidate search</h1>
        <p className="text-ink-soft mt-1">Ranked by evidence-weighted skill match against a posting&apos;s requirements, not keywords.</p>
      </div>

      {myJobs.length === 0 ? (
        <p className="text-ink-soft text-sm">Post a job first to search matched candidates against its required skills.</p>
      ) : (
        <>
          <form method="get" className="flex items-center gap-3">
            <select name="jobId" defaultValue={selectedJobId} className="rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm">
              {myJobs.map((j) => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
            <button type="submit" className="rounded-md bg-ink text-cream px-4 py-2 text-sm font-medium">Search</button>
          </form>

          {selectedJob && (
            <div className="paper-card rounded-lg p-6">
              <p className="text-sm text-ink-soft mb-4">
                Showing candidates who&apos;ve made at least one skill visible to employers, ranked against{" "}
                <span className="font-medium text-ink">{selectedJob.title}</span>&apos;s required and preferred skills.
              </p>
              {matches.length === 0 ? (
                <p className="text-sm text-ink-soft">
                  No matches yet for this posting&apos;s required skills — try broadening the required skill list, or check back as more applicants build their Passports.
                </p>
              ) : (
                <ul className="divide-y divide-paper-dim">
                  {matches.map((c) => (
                    <li key={c.userId} className="py-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-ink">{c.name}</p>
                        <span className="font-mono text-sm text-verified">{Math.round(c.score * 100)}% match</span>
                      </div>
                      <p className="text-xs text-ink-soft mt-1">
                        Matched: {c.matchedSkills.map((s) => s.skillName).join(", ") || "—"}
                      </p>
                      {c.gapSkills.length > 0 && (
                        <p className="text-xs text-ink-soft mt-0.5">
                          Gap: {c.gapSkills.map((s) => s.skillName).join(", ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
