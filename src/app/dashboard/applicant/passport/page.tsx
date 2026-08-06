import { auth } from "@/auth";
import { db } from "@/db";
import { userSkills, skills, evidenceFiles } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import StampBadge from "@/components/StampBadge";
import EvidenceFileManager from "@/components/EvidenceFileManager";
import { addSkillAction, removeSkillAction } from "@/actions/passport";

export default async function PassportPage() {
  const session = await auth();
  const userId = session!.user.id;

  const mySkills = await db
    .select({
      id: userSkills.id,
      name: skills.name,
      category: skills.category,
      evidence: userSkills.evidence,
      verificationLevel: userSkills.verificationLevel,
      visibility: userSkills.visibility,
    })
    .from(userSkills)
    .innerJoin(skills, eq(skills.id, userSkills.skillId))
    .where(eq(userSkills.userId, userId));

  const filesBySkill = mySkills.length
    ? await db
        .select({ id: evidenceFiles.id, userSkillId: evidenceFiles.userSkillId, fileName: evidenceFiles.fileName, mimeType: evidenceFiles.mimeType, sizeBytes: evidenceFiles.sizeBytes, uploadedAt: evidenceFiles.uploadedAt })
        .from(evidenceFiles)
        .where(inArray(evidenceFiles.userSkillId, mySkills.map((s) => s.id)))
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Skills Passport</h1>
        <p className="text-ink-soft mt-1 max-w-2xl">
          Every skill here can carry evidence — a project, a credential, a role — which raises its verification
          level and strengthens every downstream recommendation and employer match.
        </p>
      </div>

      <form action={addSkillAction} className="paper-card rounded-lg p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold">Add a skill</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Skill name</label>
            <input name="skillName" required maxLength={150} placeholder="e.g. Stakeholder communication"
              className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Category</label>
            <input name="category" required maxLength={100} placeholder="e.g. Communication"
              className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">
            Evidence (optional — adding this moves the skill to &ldquo;Evidence-linked&rdquo;)
          </label>
          <textarea name="evidence" maxLength={2000} rows={3} placeholder="Describe the project, role, or credential that demonstrates this skill"
            className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
        </div>
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Visible to</label>
            <select name="visibility" defaultValue="EMPLOYERS" className="rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm">
              <option value="PRIVATE">Only me</option>
              <option value="EMPLOYERS">Employers I apply to</option>
              <option value="PUBLIC">Public profile</option>
            </select>
          </div>
          <button type="submit" className="ml-auto rounded-md bg-stamp text-cream px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity">
            Add to Passport
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {mySkills.length === 0 ? (
          <p className="text-ink-soft text-sm">Your Passport is empty. Add your first skill above to get started.</p>
        ) : (
          mySkills.map((s) => (
            <div key={s.id} className="paper-card rounded-lg p-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="font-medium text-ink">{s.name}</p>
                  <span className="text-xs font-mono text-ink-soft uppercase">{s.category}</span>
                  <StampBadge level={s.verificationLevel as "SELF_REPORTED" | "EVIDENCE_LINKED" | "VERIFIED"} />
                </div>
                {s.evidence && <p className="text-sm text-ink-soft mt-2">{s.evidence}</p>}
                <p className="text-xs text-ink-soft mt-2 font-mono">Visible to: {s.visibility.toLowerCase()}</p>
                <EvidenceFileManager userSkillId={s.id} initialFiles={filesBySkill.filter((f) => f.userSkillId === s.id)} />
              </div>
              <form action={removeSkillAction.bind(null, s.id)}>
                <button type="submit" className="text-xs text-stamp font-medium shrink-0 hover:underline">Remove</button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
