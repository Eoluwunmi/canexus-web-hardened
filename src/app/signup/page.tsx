"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signupAction, SignupState } from "@/actions/auth";

const roles = [
  { value: "APPLICANT", label: "I'm looking for work", desc: "Build your Skills Passport and get matched" },
  { value: "EMPLOYER", label: "I'm hiring", desc: "Post roles and search skills-verified candidates" },
  { value: "MENTOR", label: "I want to mentor", desc: "Guide people through their career transition" },
] as const;

export default function SignupPage() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(signupAction, {});
  const [role, setRole] = useState<(typeof roles)[number]["value"]>("APPLICANT");

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-paper">
      <div className="w-full max-w-md">
        <Link href="/" className="font-display text-2xl font-semibold text-ink block text-center mb-8">CANexus</Link>
        <div className="paper-card rounded-lg p-8">
          <h1 className="font-display text-xl font-semibold text-ink mb-6">Create your account</h1>

          <div className="space-y-2 mb-6">
            {roles.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={`w-full text-left rounded-md border px-4 py-3 transition-colors ${
                  role === r.value ? "border-stamp bg-stamp-dim" : "border-paper-dim hover:border-ink-soft"
                }`}
              >
                <p className="text-sm font-medium text-ink">{r.label}</p>
                <p className="text-xs text-ink-soft mt-0.5">{r.desc}</p>
              </button>
            ))}
          </div>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="role" value={role} />
            <div>
              <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Full name</label>
              <input name="name" required className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Email</label>
              <input name="email" type="email" required className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Password</label>
              <input name="password" type="password" required minLength={8} className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
            </div>
            {role === "EMPLOYER" && (
              <div>
                <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Organization name</label>
                <input name="orgName" required className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
              </div>
            )}
            {state.error && <p className="text-sm text-stamp">{state.error}</p>}
            <button type="submit" disabled={pending} className="w-full rounded-md bg-stamp text-cream px-4 py-2.5 text-sm font-medium disabled:opacity-50">
              {pending ? "Creating account…" : "Create account"}
            </button>
          </form>
          <p className="text-sm text-ink-soft mt-6 text-center">
            Already have an account? <Link href="/login" className="text-stamp underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
