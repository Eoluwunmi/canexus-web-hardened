import { auth } from "@/auth";
import { db } from "@/db";
import { mentorProfiles, mentorSessions, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { respondToSessionAction } from "@/actions/mentors";

export default async function MentorOverview() {
  const session = await auth();
  const [profile] = await db.select().from(mentorProfiles).where(eq(mentorProfiles.userId, session!.user.id)).limit(1);

  const sessions = profile
    ? await db
        .select({
          id: mentorSessions.id,
          scheduledAt: mentorSessions.scheduledAt,
          status: mentorSessions.status,
          notes: mentorSessions.notes,
          menteeName: users.name,
        })
        .from(mentorSessions)
        .innerJoin(users, eq(users.id, mentorSessions.menteeUserId))
        .where(eq(mentorSessions.mentorId, profile.id))
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Mentor dashboard</h1>
        <p className="text-ink-soft mt-1">Manage your session requests and mentee history.</p>
      </div>

      <div className="paper-card rounded-lg p-6">
        <h2 className="font-display text-lg font-semibold mb-4">Sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-ink-soft text-sm">
            No session requests yet.{" "}
            <a href="/dashboard/mentor/profile" className="text-stamp underline">Complete your profile</a> so applicants can find you.
          </p>
        ) : (
          <ul className="divide-y divide-paper-dim">
            {sessions.map((s) => (
              <li key={s.id} className="py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-ink">{s.menteeName}</p>
                  <p className="text-xs text-ink-soft mt-0.5">{new Date(s.scheduledAt).toLocaleString("en-CA")}</p>
                  {s.notes && <p className="text-sm text-ink-soft mt-1">{s.notes}</p>}
                  <p className="text-xs font-mono uppercase text-ink-soft mt-1">{s.status}</p>
                </div>
                {s.status === "REQUESTED" && (
                  <div className="flex gap-2 shrink-0">
                    <form action={respondToSessionAction.bind(null, s.id, "CONFIRMED")}>
                      <button className="text-xs rounded-md bg-verified text-cream px-3 py-1.5 font-medium">Confirm</button>
                    </form>
                    <form action={respondToSessionAction.bind(null, s.id, "CANCELLED")}>
                      <button className="text-xs rounded-md border border-paper-dim px-3 py-1.5 font-medium text-ink-soft">Decline</button>
                    </form>
                  </div>
                )}
                {s.status === "CONFIRMED" && (
                  <form action={respondToSessionAction.bind(null, s.id, "COMPLETED")}>
                    <button className="text-xs rounded-md border border-paper-dim px-3 py-1.5 font-medium text-ink-soft shrink-0">Mark completed</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
