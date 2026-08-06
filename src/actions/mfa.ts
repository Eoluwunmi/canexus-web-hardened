"use server";

import { db } from "@/db";
import { users, userMfa } from "@/db/schema";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";
import {
  generateTotpSecret,
  buildOtpauthUri,
  buildQrCodeDataUrl,
  verifyTotpToken,
  generateBackupCodes,
  hashBackupCodes,
  isMfaEligibleRole,
} from "@/lib/mfa";

/** Volume 8: MFA is required for ADMIN and for employer accounts flagged as employer-admin. */
async function requireMfaEligibleUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Not authorized");
  const [row] = await db
    .select({ role: users.role, isEmployerAdmin: users.isEmployerAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!row || !isMfaEligibleRole(row.role, row.isEmployerAdmin)) {
    throw new Error("MFA is not applicable to this account");
  }
  return session.user;
}

export type MfaStatus = { eligible: boolean; enabled: boolean };

export async function getMfaStatusAction(): Promise<MfaStatus> {
  const session = await auth();
  if (!session?.user) return { eligible: false, enabled: false };
  const [row] = await db
    .select({ role: users.role, isEmployerAdmin: users.isEmployerAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!row || !isMfaEligibleRole(row.role, row.isEmployerAdmin)) return { eligible: false, enabled: false };

  const [mfa] = await db.select({ enabled: userMfa.enabled }).from(userMfa).where(eq(userMfa.userId, session.user.id)).limit(1);
  return { eligible: true, enabled: mfa?.enabled ?? false };
}

/** Step 1 of enrollment: generates a new secret (not yet enabled), returns the QR code and
 *  manual-entry secret. Calling this again before confirming replaces the pending secret,
 *  which is fine since it isn't active until confirmMfaSetupAction verifies a live code. */
export async function setupMfaAction() {
  const user = await requireMfaEligibleUser();
  const secret = generateTotpSecret();
  const otpauthUri = buildOtpauthUri(user.email!, secret);
  const qrCodeDataUrl = await buildQrCodeDataUrl(otpauthUri);

  await db
    .insert(userMfa)
    .values({ userId: user.id, secret, enabled: false })
    .onConflictDoUpdate({ target: userMfa.userId, set: { secret, enabled: false, backupCodes: null } });

  return { secret, qrCodeDataUrl };
}

/** Step 2: user proves they scanned the QR (or entered the secret) correctly by submitting a
 *  live code. Only on success does MFA actually become enforced at login. */
export async function confirmMfaSetupAction(formData: FormData) {
  const user = await requireMfaEligibleUser();
  const token = String(formData.get("token") ?? "").trim();

  const [mfa] = await db.select().from(userMfa).where(eq(userMfa.userId, user.id)).limit(1);
  if (!mfa) throw new Error("Start MFA setup first");
  if (!verifyTotpToken(token, mfa.secret)) throw new Error("That code didn't match — check your authenticator app and try again");

  const backupCodes = generateBackupCodes();
  const hashed = await hashBackupCodes(backupCodes);

  await db.update(userMfa).set({ enabled: true, backupCodes: hashed }).where(eq(userMfa.userId, user.id));

  await logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: "MFA_ENABLED",
    targetUserId: user.id,
    targetResource: `user:${user.id}`,
  });

  return { backupCodes };
}

/**
 * Pre-login check used by the two-step login form (src/app/login/page.tsx). NextAuth's
 * `authorize` callback is a single stateless call, so the client needs to know *before*
 * calling next-auth's signIn() whether to show a second "enter your code" step. This
 * re-validates the password directly (mirrors src/auth.ts's authorize logic) — it does NOT
 * establish a session; only the real signIn() call does that, and it re-checks everything
 * (including the MFA code) server-side again for defense in depth.
 *
 * Note: like the rest of this MVP's auth flow, this has no rate-limiting/lockout of its own —
 * flagged in SECURITY.md as a pre-launch follow-up (brute-force protection on credential checks).
 */
export async function checkMfaRequiredAction(email: string, password: string): Promise<{ valid: boolean; mfaRequired: boolean }> {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (!user || user.status !== "ACTIVE") return { valid: false, mfaRequired: false };

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { valid: false, mfaRequired: false };

  if (!isMfaEligibleRole(user.role, user.isEmployerAdmin)) return { valid: true, mfaRequired: false };

  const [mfa] = await db.select({ enabled: userMfa.enabled }).from(userMfa).where(eq(userMfa.userId, user.id)).limit(1);
  return { valid: true, mfaRequired: mfa?.enabled ?? false };
}
