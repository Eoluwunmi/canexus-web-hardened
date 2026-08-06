const TYPE_LABELS: Record<string, string> = {
  WAGE_SUBSIDY: "Wage subsidy",
  GRANT: "Grant",
  SCHOLARSHIP: "Scholarship",
  TAX_CREDIT: "Tax credit",
  BURSARY: "Bursary",
};

type Incentive = {
  id: string;
  title: string;
  description: string;
  incentiveType: string;
  jurisdiction: string;
  amountDescription: string;
  eligibilitySummary: string;
  sourceUrl: string;
  applicationDeadline: Date | null;
};

/** Receives an already audience-filtered, active-only, expiring-soonest-first list from the
 *  page (applicant or employer) — this component only handles the jurisdiction/type UI
 *  filters (derived from the same list, so no extra query) and the deadline-passed flag. */
export default function FundingIncentiveBrowser({ incentives, basePath, jurisdiction, incentiveType }: {
  incentives: Incentive[];
  basePath: string;
  jurisdiction?: string;
  incentiveType?: string;
}) {
  const jurisdictions = Array.from(new Set(incentives.map((i) => i.jurisdiction))).sort();
  const filtered = incentives.filter(
    (i) => (!jurisdiction || i.jurisdiction === jurisdiction) && (!incentiveType || i.incentiveType === incentiveType),
  );

  function filterUrl(next: { jurisdiction?: string; incentiveType?: string }) {
    const params = new URLSearchParams();
    const j = next.jurisdiction !== undefined ? next.jurisdiction : jurisdiction;
    const t = next.incentiveType !== undefined ? next.incentiveType : incentiveType;
    if (j) params.set("jurisdiction", j);
    if (t) params.set("type", t);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-wrap gap-2">
          <a href={filterUrl({ jurisdiction: "" })} className={`text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-full border ${!jurisdiction ? "bg-ink text-cream border-ink" : "border-paper-dim text-ink-soft hover:border-stamp"}`}>
            All jurisdictions
          </a>
          {jurisdictions.map((j) => (
            <a key={j} href={filterUrl({ jurisdiction: j })} className={`text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-full border ${jurisdiction === j ? "bg-ink text-cream border-ink" : "border-paper-dim text-ink-soft hover:border-stamp"}`}>
              {j}
            </a>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={filterUrl({ incentiveType: "" })} className={`text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-full border ${!incentiveType ? "bg-ink text-cream border-ink" : "border-paper-dim text-ink-soft hover:border-stamp"}`}>
          All types
        </a>
        {Object.entries(TYPE_LABELS).map(([value, label]) => (
          <a key={value} href={filterUrl({ incentiveType: value })} className={`text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-full border ${incentiveType === value ? "bg-ink text-cream border-ink" : "border-paper-dim text-ink-soft hover:border-stamp"}`}>
            {label}
          </a>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-ink-soft text-sm">No funding incentives match these filters right now.</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((f) => {
            const deadlinePassed = f.applicationDeadline ? f.applicationDeadline < new Date() : false;
            return (
              <div key={f.id} className="paper-card rounded-lg p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-display text-lg font-semibold text-ink">{f.title}</h2>
                      <span className="text-xs font-mono uppercase text-ink-soft border border-paper-dim rounded-full px-2 py-0.5">{TYPE_LABELS[f.incentiveType] ?? f.incentiveType}</span>
                      <span className="text-xs font-mono uppercase text-ink-soft">{f.jurisdiction}</span>
                    </div>
                    <p className="text-sm text-brass font-medium mt-1">{f.amountDescription}</p>
                  </div>
                  {f.applicationDeadline && (
                    <span className={`text-xs font-mono uppercase shrink-0 ${deadlinePassed ? "text-stamp" : "text-ink-soft"}`}>
                      {deadlinePassed ? "Deadline passed" : "Apply by"} {f.applicationDeadline.toLocaleDateString("en-CA")}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-soft mt-3">{f.description}</p>
                <p className="text-xs text-ink-soft mt-3"><span className="font-medium">Eligibility:</span> {f.eligibilitySummary}</p>
                <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-stamp font-medium hover:underline mt-3">
                  View official source →
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
