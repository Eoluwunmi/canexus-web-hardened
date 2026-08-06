"use client";

import { useState } from "react";
import { setupMfaAction, confirmMfaSetupAction } from "@/actions/mfa";

type Stage = "idle" | "enrolling" | "enabled";

export default function MfaSetup({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [stage, setStage] = useState<Stage>(initiallyEnabled ? "enabled" : "idle");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function startEnrollment() {
    setBusy(true);
    setError("");
    try {
      const { secret, qrCodeDataUrl } = await setupMfaAction();
      setSecret(secret);
      setQrCodeDataUrl(qrCodeDataUrl);
      setStage("enrolling");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start setup");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(formData: FormData) {
    setBusy(true);
    setError("");
    try {
      const { backupCodes } = await confirmMfaSetupAction(formData);
      setBackupCodes(backupCodes);
      setStage("enabled");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That code didn't work");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "enabled" && !backupCodes) {
    return (
      <div className="paper-card rounded-lg p-6">
        <p className="text-verified font-medium">Two-factor authentication is enabled on this account.</p>
      </div>
    );
  }

  if (backupCodes) {
    return (
      <div className="paper-card rounded-lg p-6 space-y-4">
        <p className="text-verified font-medium">Two-factor authentication is now enabled.</p>
        <div>
          <p className="text-sm text-ink-soft mb-2">
            Save these one-time backup codes somewhere safe — each works once, if you ever lose access to
            your authenticator app. They won&apos;t be shown again.
          </p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-paper-dim rounded-md p-4">
            {backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stage === "enrolling" && qrCodeDataUrl && secret) {
    return (
      <div className="paper-card rounded-lg p-6 space-y-4">
        <p className="text-sm text-ink-soft">
          Scan this with your authenticator app, or enter the code manually, then confirm with a live code below.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrCodeDataUrl} alt="MFA QR code" width={200} height={200} className="rounded-md border border-paper-dim" />
        <p className="text-xs font-mono text-ink-soft break-all">Manual entry secret: {secret}</p>
        <form action={handleConfirm} className="space-y-3">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Enter the 6-digit code</label>
            <input name="token" required maxLength={6} className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm tracking-widest" />
          </div>
          {error && <p className="text-sm text-stamp">{error}</p>}
          <button type="submit" disabled={busy} className="rounded-md bg-stamp text-cream px-5 py-2.5 text-sm font-medium disabled:opacity-50">
            {busy ? "Confirming…" : "Confirm & enable"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="paper-card rounded-lg p-6 space-y-4">
      <p className="text-sm text-ink-soft">Two-factor authentication is not yet enabled on this account.</p>
      {error && <p className="text-sm text-stamp">{error}</p>}
      <button onClick={startEnrollment} disabled={busy} className="rounded-md bg-stamp text-cream px-5 py-2.5 text-sm font-medium disabled:opacity-50">
        {busy ? "Starting…" : "Set up two-factor authentication"}
      </button>
    </div>
  );
}
