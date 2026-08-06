import Link from "next/link";
import { getAllFundingIncentivesForAdmin, deactivateFundingIncentiveAction } from "@/actions/funding";

export default async function AdminFundingPage() {
  const incentives = await getAllFundingIncentivesForAdmin();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Funding Incentives</h1>
          <p className="text-ink-soft mt-1 max-w-2xl">
            Curated grants and subsidies shown to applicants and employers. There&apos;s no hard delete —
            retiring one deactivates it instead, keeping the record and its edit history intact.
          </p>
        </div>
        <Link href="/dashboard/admin/funding/new" className="shrink-0 rounded-md bg-stamp text-cream px-4 py-2.5 text-sm font-medium hover:opacity-90">
          New incentive
        </Link>
      </div>

      {incentives.length === 0 ? (
        <p className="text-ink-soft text-sm">No funding incentives yet.</p>
      ) : (
        <div className="space-y-3">
          {incentives.map((f) => (
            <div key={f.id} className={`paper-card rounded-lg p-5 flex items-start justify-between gap-4 ${!f.isActive ? "opacity-50" : ""}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-ink">{f.title}</p>
                  <span className="text-xs font-mono uppercase text-ink-soft">{f.audience}</span>
                  <span className="text-xs font-mono uppercase text-ink-soft">{f.jurisdiction}</span>
                  {!f.isActive && <span className="text-xs font-mono uppercase text-stamp">Inactive</span>}
                </div>
                <p className="text-sm text-ink-soft mt-1">{f.amountDescription}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link href={`/dashboard/admin/funding/${f.id}/edit`} className="text-xs text-stamp font-medium hover:underline">
                  Edit
                </Link>
                {f.isActive && (
                  <form action={deactivateFundingIncentiveAction.bind(null, f.id)}>
                    <button type="submit" className="text-xs text-ink-soft font-medium hover:underline">Deactivate</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
