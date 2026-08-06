const styles: Record<string, { color: string; label: string }> = {
  SELF_REPORTED: { color: "text-ink-soft", label: "Self-reported" },
  EVIDENCE_LINKED: { color: "text-brass", label: "Evidence-linked" },
  VERIFIED: { color: "text-verified", label: "Verified" },
};

export default function StampBadge({ level }: { level: keyof typeof styles }) {
  const s = styles[level] ?? styles.SELF_REPORTED;
  return <span className={`stamp ${s.color}`}>{s.label}</span>;
}
