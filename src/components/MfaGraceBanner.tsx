import Link from "next/link";
import { getMfaStatusAction } from "@/actions/mfa";

/** Volume 8: MFA must be enforced once enabled, but accounts that existed before this
 *  requirement shouldn't be locked out immediately — this banner is the "grace-period
 *  enrollment prompt" for existing admin/employer-admin accounts that haven't enrolled yet. */
export default async function MfaGraceBanner() {
  const status = await getMfaStatusAction();
  if (!status.eligible || status.enabled) return null;

  return (
    <div className="bg-stamp-dim border border-stamp/30 rounded-md px-4 py-3 text-sm flex items-center justify-between gap-4">
      <p className="text-ink">
        <span className="font-medium">Action needed:</span> two-factor authentication is required for this
        account type and isn&apos;t set up yet.
      </p>
      <Link href="/dashboard/mfa" className="shrink-0 rounded-md bg-stamp text-cream px-3 py-1.5 text-xs font-medium hover:opacity-90">
        Set up now
      </Link>
    </div>
  );
}
