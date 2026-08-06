import { authenticator } from "otplib";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const ISSUER = "CANexus";

/** Volume 8: MFA is required for ADMIN and for employer accounts flagged as employer-admin.
 *  Lives in this plain lib file (not actions/mfa.ts) because it's a synchronous helper —
 *  everything exported from a "use server" file must be an async server action. */
export function isMfaEligibleRole(role: string, isEmployerAdmin: boolean): boolean {
  return role === "ADMIN" || (role === "EMPLOYER" && isEmployerAdmin);
}

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function buildOtpauthUri(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export async function buildQrCodeDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri);
}

export function verifyTotpToken(token: string, secret: string): boolean {
  try {
    return authenticator.check(token, secret);
  } catch {
    return false;
  }
}

/** Generates a fresh set of one-time-use backup codes, e.g. for account recovery if the
 *  authenticator device is lost. Returned once in plaintext for the user to save; only the
 *  bcrypt hashes are persisted (see hashBackupCodes / verifyBackupCode). */
export function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () => crypto.randomBytes(5).toString("hex"));
}

export async function hashBackupCodes(codes: string[]): Promise<string> {
  const hashed = await Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
  return JSON.stringify(hashed);
}

/** Returns the remaining hashes (with the matched one removed, so each backup code is
 *  single-use) if `code` matches one of `hashedCodesJson`, otherwise null. */
export async function consumeBackupCode(code: string, hashedCodesJson: string | null): Promise<string | null> {
  if (!hashedCodesJson) return null;
  let hashes: string[];
  try {
    hashes = JSON.parse(hashedCodesJson);
  } catch {
    return null;
  }
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(code, hashes[i])) {
      const remaining = [...hashes.slice(0, i), ...hashes.slice(i + 1)];
      return JSON.stringify(remaining);
    }
  }
  return null;
}
