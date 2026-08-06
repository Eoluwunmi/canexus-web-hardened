import Link from "next/link";

export default function AdminOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Admin</h1>
        <p className="text-ink-soft mt-1 max-w-2xl">
          Platform trust &amp; safety surface: anomaly review over the append-only audit trail, and the
          skill-verification queue (Volume 8).
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/dashboard/admin/audit-log" className="paper-card rounded-lg p-6 block hover:opacity-90">
          <h2 className="font-display text-lg font-semibold">Audit Log</h2>
          <p className="text-sm text-ink-soft mt-1">Read-only, append-only record of sensitive actions across the platform.</p>
        </Link>
        <Link href="/dashboard/admin/verification" className="paper-card rounded-lg p-6 block hover:opacity-90">
          <h2 className="font-display text-lg font-semibold">Skill Verification</h2>
          <p className="text-sm text-ink-soft mt-1">Evidence-linked skills awaiting a Verified determination.</p>
        </Link>
      </div>
    </div>
  );
}
