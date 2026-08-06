import { auth } from "@/auth";
import { db } from "@/db";
import { mentorProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateMentorProfileAction } from "@/actions/mentors";

export default async function MentorProfilePage() {
  const session = await auth();
  const [profile] = await db.select().from(mentorProfiles).where(eq(mentorProfiles.userId, session!.user.id)).limit(1);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">My mentor profile</h1>
        <p className="text-ink-soft mt-1">This is what applicants see when browsing mentors.</p>
      </div>
      <form action={updateMentorProfileAction} className="paper-card rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Expertise (comma-separated)</label>
          <input name="expertiseTags" defaultValue={profile?.expertiseTags ?? ""} placeholder="e.g. Tech career transitions, Project management"
            className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Bio</label>
          <textarea name="bio" defaultValue={profile?.bio ?? ""} rows={5} maxLength={2000}
            className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-md bg-stamp text-cream px-5 py-2.5 text-sm font-medium hover:opacity-90">
          Save profile
        </button>
      </form>
    </div>
  );
}
