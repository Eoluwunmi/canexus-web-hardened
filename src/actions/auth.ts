"use server";

import { db } from "@/db";
import { users, employers, mentorProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn } from "@/auth";

const signupSchema = z.object({
  name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["APPLICANT", "EMPLOYER", "MENTOR"]),
  orgName: z.string().optional(),
});

export type SignupState = { error?: string };

export async function signupAction(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    orgName: formData.get("orgName") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details and try again." };
  }
  const { name, email, password, role, orgName } = parsed.data;

  const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (existing.length > 0) {
    return { error: "An account with that email already exists. Try logging in instead." };
  }

  if (role === "EMPLOYER" && !orgName) {
    return { error: "Organization name is required for employer accounts." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db
    .insert(users)
    .values({ name, email: email.toLowerCase(), passwordHash, role, isEmployerAdmin: role === "EMPLOYER" })
    .returning();

  if (role === "EMPLOYER") {
    await db.insert(employers).values({ ownerUserId: user.id, orgName: orgName! });
  }
  if (role === "MENTOR") {
    await db.insert(mentorProfiles).values({ userId: user.id, bio: "", expertiseTags: "" });
  }

  await signIn("credentials", { email: email.toLowerCase(), password, redirectTo: roleHome(role) });
  return {};
}

function roleHome(role: string) {
  if (role === "EMPLOYER") return "/dashboard/employer";
  if (role === "MENTOR") return "/dashboard/mentor";
  return "/dashboard/applicant";
}
