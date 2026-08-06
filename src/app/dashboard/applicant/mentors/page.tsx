import { auth } from "@/auth";
import { db } from "@/db";
import { mentorProfiles, users, mentorSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requestSessionAction } from "@/actions/mentors";

export default async function MentorsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const mentors = await db
    .select({ id: mentorProfiles.id, bio: mentorProfiles.bio, expertiseTags: mentorProfiles.expertiseTags, name: users.name })
    .from(mentorProfiles)
    .innerJoin(users, eq(users.id, mentorProfiles.userId))
    .where(eq(mentorProfiles.status, "ACTIVE"));

  const mySessions = await db
    .select({ id: mentorSessions.id, status: mentorSessions.status, scheduledAt: mentorSessions.scheduledAt, mentorId: mentorSessions.mentorId })
    .from(mentorSessions)
    .where(eq(mentorSessions.menteeUserId, userId));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Mentors</h1>
        <p className="text-ink-soft mt-1">Book time with people who&apos;ve made the transition you&apos;re aiming for.</p>
      </div>

      {mySessions.length > 0 && (
        <div className="paper-card rounded-lg p-6">
          <h2 className="font-display text-lg font-semibold mb-3">Your sessions</h2>
          <ul className="divide-y divide-paper-dim">
            {mySessions.map((s) => (
              <li key={s.id} className="py-2 flex justify-between text-sm">
                <span>{new Date(s.scheduledAt).toLocaleString("en-CA")}</span>
                <span className="font-mono uppercase text-ink-soft">{s.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-5">
        {mentors.map((m) => (
          <div key={m.id} className="paper-card rounded-lg p-5">
            <h3 className="font-display text-lg font-semibold text-ink">{m.name}</h3>
            <p className="text-xs text-brass font-mono mt-1">{m.expertiseTags || "General career guidance"}</p>
            <p className="text-sm text-ink-soft mt-2">{m.bio || "No bio yet."}</p>
            <form
              action={async (formData: FormData) => {
                "use server";
                await requestSessionAction(
                  m.id,
                  formData.get("scheduledAt") as string,
                  (formData.get("notes") as string) || "",
                );
              }}
              className="mt-4 space-y-2"
            >
              <input type="datetime-local" name="scheduledAt" required className="w-full rounded-md border border-paper-dim bg-cream px-2 py-1.5 text-sm" />
              <input type="text" name="notes" placeholder="What would you like to discuss?" className="w-full rounded-md border border-paper-dim bg-cream px-2 py-1.5 text-sm" />
              <button type="submit" className="w-full rounded-md bg-stamp text-cream px-3 py-2 text-sm font-medium hover:opacity-90">
                Request session
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
