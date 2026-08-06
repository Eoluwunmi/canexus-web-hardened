type Incentive = {
  title: string;
  description: string;
  incentiveType: string;
  audience: string;
  jurisdiction: string;
  amountDescription: string;
  eligibilitySummary: string;
  sourceUrl: string;
  applicationDeadline: Date | null;
};

const INCENTIVE_TYPES = ["WAGE_SUBSIDY", "GRANT", "SCHOLARSHIP", "TAX_CREDIT", "BURSARY"];
const INCENTIVE_TYPE_LABELS: Record<string, string> = {
  WAGE_SUBSIDY: "Wage subsidy",
  GRANT: "Grant",
  SCHOLARSHIP: "Scholarship",
  TAX_CREDIT: "Tax credit",
  BURSARY: "Bursary",
};

export default function FundingIncentiveForm({ action, initial, submitLabel }: { action: (formData: FormData) => Promise<void>; initial?: Incentive; submitLabel: string }) {
  return (
    <form action={action} className="paper-card rounded-lg p-6 space-y-4">
      <div>
        <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Title</label>
        <input name="title" required maxLength={200} defaultValue={initial?.title} className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Description</label>
        <textarea name="description" required rows={3} maxLength={3000} defaultValue={initial?.description} className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Type</label>
          <select name="incentiveType" required defaultValue={initial?.incentiveType} className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm">
            {!initial && <option value="">Select…</option>}
            {INCENTIVE_TYPES.map((t) => <option key={t} value={t}>{INCENTIVE_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Audience</label>
          <select name="audience" required defaultValue={initial?.audience} className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm">
            {!initial && <option value="">Select…</option>}
            <option value="APPLICANT">Applicants</option>
            <option value="EMPLOYER">Employers</option>
            <option value="BOTH">Both</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Jurisdiction</label>
          <input name="jurisdiction" required maxLength={100} placeholder="e.g. Federal, Alberta" defaultValue={initial?.jurisdiction} className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Amount</label>
          <input name="amountDescription" required maxLength={300} placeholder="e.g. Up to $7,000, 50% of wages" defaultValue={initial?.amountDescription} className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Application deadline (optional)</label>
          <input name="applicationDeadline" type="date" defaultValue={initial?.applicationDeadline ? initial.applicationDeadline.toISOString().slice(0, 10) : undefined} className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Eligibility summary</label>
        <textarea name="eligibilitySummary" required rows={3} maxLength={3000} defaultValue={initial?.eligibilitySummary} className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Source URL</label>
        <input name="sourceUrl" type="url" required maxLength={2000} placeholder="https://…" defaultValue={initial?.sourceUrl} className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
      </div>
      <button type="submit" className="rounded-md bg-stamp text-cream px-5 py-2.5 text-sm font-medium hover:opacity-90">
        {submitLabel}
      </button>
    </form>
  );
}
