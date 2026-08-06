const LABELS: Record<string, string> = {
  JOB: "Job",
  CO_OP: "Co-op",
  INTERNSHIP: "Internship",
  MICRO_INTERNSHIP: "Micro-internship",
  APPRENTICESHIP: "Apprenticeship",
  PRACTICUM: "Practicum",
};

export default function OpportunityTypeBadge({ type }: { type: string }) {
  const label = LABELS[type] ?? type;

  // Micro-internships are the low-barrier entry point (per spec) — visually distinct from
  // everything else rather than just another value in the same badge style.
  if (type === "MICRO_INTERNSHIP") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brass text-cream px-3 py-1 text-xs font-mono uppercase tracking-wide">
        ✦ {label}
      </span>
    );
  }

  if (type === "JOB") {
    // The default/base case is deliberately unadorned — everything else is a WIL variant.
    return <span className="text-xs font-mono uppercase tracking-wide text-ink-soft">{label}</span>;
  }

  return (
    <span className="inline-flex items-center rounded-full border border-verified text-verified px-3 py-1 text-xs font-mono uppercase tracking-wide">
      {label}
    </span>
  );
}
