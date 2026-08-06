import { getPendingVerifications, adminVerifySkillAction } from "@/actions/admin";
import AdminFileViewer from "@/components/AdminFileViewer";

export default async function VerificationQueuePage() {
  const pending = await getPendingVerifications();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Skill Verification</h1>
        <p className="text-ink-soft mt-1 max-w-2xl">
          Evidence-linked skills an applicant has attached proof to. Verifying raises the skill to the
          highest trust level and is logged to the audit trail.
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="text-ink-soft text-sm">Nothing awaiting verification right now.</p>
      ) : (
        <div className="space-y-3">
          {pending.map((p) => (
            <div key={p.id} className="paper-card rounded-lg p-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  {p.skillName} <span className="text-ink-soft font-normal">— {p.applicantName}</span>
                </p>
                <p className="text-xs text-ink-soft font-mono mt-0.5">{p.applicantEmail}</p>
                {p.evidence && <p className="text-sm text-ink-soft mt-2">{p.evidence}</p>}
                <AdminFileViewer files={p.files} />
              </div>
              <form action={adminVerifySkillAction.bind(null, p.id)}>
                <button type="submit" className="rounded-md bg-verified text-cream px-4 py-2 text-xs font-medium shrink-0 hover:opacity-90">
                  Mark Verified
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
