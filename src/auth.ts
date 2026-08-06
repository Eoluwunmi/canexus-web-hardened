import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users, userMfa } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { verifyTotpToken, consumeBackupCode, isMfaEligibleRole } from "@/lib/mfa";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  mfaCode: z.string().optional(),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password, mfaCode } = parsed.data;

        const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
        if (!user) return null;
        if (user.status !== "ACTIVE") return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // MFA enforcement (Volume 8): required for ADMIN and employer-admin accounts, but only
        // once they've actually enrolled — see the grace-period note on MfaGraceBanner.
        if (isMfaEligibleRole(user.role, user.isEmployerAdmin)) {
          const [mfa] = await db.select().from(userMfa).where(eq(userMfa.userId, user.id)).limit(1);
          if (mfa?.enabled) {
            if (!mfaCode) return null;
            const validTotp = verifyTotpToken(mfaCode, mfa.secret);
            if (!validTotp) {
              // Fall back to a backup code — single-use, so persist the reduced set on success.
              const remaining = await consumeBackupCode(mfaCode, mfa.backupCodes);
              if (!remaining) return null;
              await db.update(userMfa).set({ backupCodes: remaining }).where(eq(userMfa.userId, user.id));
            }
          }
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: "APPLICANT" | "EMPLOYER" | "MENTOR" | "ADMIN" }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "APPLICANT" | "EMPLOYER" | "MENTOR" | "ADMIN";
      }
      return session;
    },
  },
});
