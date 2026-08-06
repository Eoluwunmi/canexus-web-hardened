"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { checkMfaRequiredAction } from "@/actions/mfa";

function LoginForm() {
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [pending, setPending] = useState<{ email: string; password: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  async function handleCredentialsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));

    const { valid, mfaRequired } = await checkMfaRequiredAction(email, password);
    if (!valid) {
      setLoading(false);
      setError("That email and password don't match an account. Check your details and try again.");
      return;
    }

    if (mfaRequired) {
      setPending({ email, password });
      setStep("mfa");
      setLoading(false);
      return;
    }

    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("That email and password don't match an account. Check your details and try again.");
      return;
    }
    window.location.href = params.get("callbackUrl") || "/dashboard";
  }

  async function handleMfaSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pending) return;
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { ...pending, mfaCode, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("That code didn't work — check your authenticator app (or use a backup code) and try again.");
      return;
    }
    window.location.href = params.get("callbackUrl") || "/dashboard";
  }

  if (step === "mfa") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-paper">
        <div className="w-full max-w-sm">
          <Link href="/" className="font-display text-2xl font-semibold text-ink block text-center mb-8">CANexus</Link>
          <div className="paper-card rounded-lg p-8">
            <h1 className="font-display text-xl font-semibold text-ink mb-2">Enter your code</h1>
            <p className="text-sm text-ink-soft mb-6">This account requires a two-factor code from your authenticator app.</p>
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">6-digit code or backup code</label>
                <input
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  required
                  autoFocus
                  className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm tracking-widest"
                />
              </div>
              {error && <p className="text-sm text-stamp">{error}</p>}
              <button type="submit" disabled={loading} className="w-full rounded-md bg-stamp text-cream px-4 py-2.5 text-sm font-medium disabled:opacity-50">
                {loading ? "Verifying…" : "Verify & log in"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("credentials"); setPending(null); setMfaCode(""); setError(""); }}
                className="w-full text-xs text-ink-soft hover:underline"
              >
                Back
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-paper">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-display text-2xl font-semibold text-ink block text-center mb-8">CANexus</Link>
        <div className="paper-card rounded-lg p-8">
          <h1 className="font-display text-xl font-semibold text-ink mb-6">Log in</h1>
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Email</label>
              <input name="email" type="email" required className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Password</label>
              <input name="password" type="password" required className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
            </div>
            {error && <p className="text-sm text-stamp">{error}</p>}
            <button type="submit" disabled={loading} className="w-full rounded-md bg-stamp text-cream px-4 py-2.5 text-sm font-medium disabled:opacity-50">
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>
          <p className="text-sm text-ink-soft mt-6 text-center">
            No account? <Link href="/signup" className="text-stamp underline">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
