import { auth } from "@/auth";
import { db } from "@/db";
import { userSkills, applications, jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { matchOccupationsForUser } from "@/lib/matching";
import Link from "next/link";

export default async function ApplicantOverview() {
  const session = await auth();
  const userId = session!.user.id;

  const mySkills = await db.select().from(userSkills).where(eq(userSkills.userId, userId));
  const matches = await matchOccupationsForUser(userId);
  const myApplications = await db
    .select({ id: applications.id, status: applications.status, jobTitle: jobs.title, matchScore: applications.matchScore })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(applications.userId, userId));

  const completeness = Math.min(100, Math.round((mySkills.length / 8) * 100));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Welcome back, {session?.user?.name?.split(" ")[0]}</h1>
        <p className="text-ink-soft mt-1">Here&apos;s where your career transition stands today.</p>
      </div>

      {/* Skill Discovery CTA */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 space-y-4">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-ink">Discover Your Skills</h2>
          <p className="text-sm text-ink-soft">
            Take a guided journey to uncover transferable skills from your experience. Perfect for career changers.
          </p>
        </div>
        <Link href="/dashboard/applicant/discovery" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">
          Start Discovery →
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <div className="paper-card rounded-lg p-5">
          <p className="text-xs font-mono uppercase tracking-wide text-ink-soft">Passport completeness</p>
          <p className="font-display text-3xl mt-2 text-ink">{completeness}%</p>
          <div className="w-full h-1.5 bg-paper-dim rounded-full mt-3">
            <div className="h-1.5 bg-verified rounded-full" style={{ width: `${completeness}%` }} />
          </div>
          <p className="text-xs text-ink-soft mt-2">{mySkills.length} skill{mySkills.length === 1 ? "" : "s"} recorded</p>
        </div>
        <div className="paper-card rounded-lg p-5">
          <p className="text-xs font-mono uppercase tracking-wide text-ink-soft">Applications</p>
          <p className="font-display text-3xl mt-2 text-ink">{myApplications.length}</p>
          <p className="text-xs text-ink-soft mt-2">Across all open roles</p>
        </div>
        <div className="paper-card rounded-lg p-5">
          <p className="text-xs font-mono uppercase tracking-wide text-ink-soft">Top occupation match</p>
          <p className="font-display text-xl mt-2 text-ink">{matches[0] ? `${matches[0].title}` : "Add skills to see matches"}</p>
          {matches[0] && <p className="text-xs text-verified mt-2">{Math.round(matches[0].score * 100)}% match · {matches[0].confidence} confidence</p>}
        </div>
      </div>

      <div className="paper-card rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">Ranked career matches</h2>
          <Link href="/dashboard/applicant/coach" className="text-sm text-stamp font-medium">Ask the AI Coach why →</Link>
        </div>
        {matches.length === 0 ? (
          <p className="text-ink-soft text-sm">
            No matches yet — <Link href="/dashboard/applicant/passport" className="text-stamp underline">build your Skills Passport</Link> to get explainable, evidence-grounded career recommendations.
          </p>
        ) : (
          <ul className="divide-y divide-paper-dim">
            {matches.slice(0, 5).map((m) => (
              <li key={m.occupationId} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{m.title}</p>
                  <p className="text-xs text-ink-soft mt-0.5">
                    Matched: {m.matchedSkills.slice(0, 3).map((s) => s.skillName).join(", ") || "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm text-ink">{Math.round(m.score * 100)}%</p>
                  <p className="text-xs text-ink-soft">{m.confidence}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="paper-card rounded-lg p-6">
        <h2 className="font-display text-lg font-semibold mb-4">Your applications</h2>
        {myApplications.length === 0 ? (
          <p className="text-ink-soft text-sm">
            No applications yet — <Link href="/dashboard/applicant/jobs" className="text-stamp underline">browse open roles</Link> matched to your skills.
          </p>
        ) : (
          <ul className="divide-y divide-paper-dim">
            {myApplications.map((a) => (
              <li key={a.id} className="py-3 flex items-center justify-between">
                <p className="font-medium text-ink">{a.jobTitle}</p>
                <span className="text-xs font-mono uppercase text-ink-soft">{a.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
