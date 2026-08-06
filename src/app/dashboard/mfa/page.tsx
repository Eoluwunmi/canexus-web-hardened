import { getMfaStatusAction } from "@/actions/mfa";
import MfaSetup from "@/components/MfaSetup";

export default async function MfaPage() {
  const status = await getMfaStatusAction();

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Two-factor authentication</h1>
        <p className="text-ink-soft mt-1">
          Required for admin and employer-admin accounts (Volume 8). Uses any TOTP authenticator app
          (Google Authenticator, 1Password, Authy, etc.).
        </p>
      </div>

      {!status.eligible ? (
        <p className="text-ink-soft text-sm">Two-factor authentication isn&apos;t required for this account type.</p>
      ) : (
        <MfaSetup initiallyEnabled={status.enabled} />
      )}
    </div>
  );
}
