"use server";

import { db } from "@/db";
import { mentorProfiles, mentorSessions } from "@/db/schema";
import { auth } from "@/auth";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function requireMentor() {
  const session = await auth();
  if (!session?.user || session.user.role !== "MENTOR") throw new Error("Not authorized");
  const [profile] = await db.select().from(mentorProfiles).where(eq(mentorProfiles.userId, session.user.id)).limit(1);
  if (!profile) throw new Error("Mentor profile not found");
  return { user: session.user, profile };
}

const profileSchema = z.object({
  bio: z.string().max(2000).optional(),
  expertiseTags: z.string().max(500).optional(),
});

export async function updateMentorProfileAction(formData: FormData) {
  const { profile } = await requireMentor();
  const parsed = profileSchema.safeParse({
    bio: formData.get("bio") || undefined,
    expertiseTags: formData.get("expertiseTags") || undefined,
  });
  if (!parsed.success) throw new Error("Invalid profile data");
  await db.update(mentorProfiles).set(parsed.data).where(eq(mentorProfiles.id, profile.id));
  revalidatePath("/dashboard/mentor");
}

export async function requestSessionAction(mentorProfileId: string, scheduledAtISO: string, notes: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "APPLICANT") throw new Error("Not authorized");
  const scheduledAt = new Date(scheduledAtISO);
  if (isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
    throw new Error("Please choose a valid future date and time.");
  }
  await db.insert(mentorSessions).values({
    mentorId: mentorProfileId,
    menteeUserId: session.user.id,
    scheduledAt,
    notes,
    status: "REQUESTED",
  });
  revalidatePath("/dashboard/applicant/mentors");
  revalidatePath("/dashboard/mentor");
}

export async function respondToSessionAction(sessionId: string, status: "CONFIRMED" | "CANCELLED" | "COMPLETED") {
  const { profile } = await requireMentor();
  await db
    .update(mentorSessions)
    .set({ status })
    .where(and(eq(mentorSessions.id, sessionId), eq(mentorSessions.mentorId, profile.id)));
  revalidatePath("/dashboard/mentor");
  revalidatePath("/dashboard/applicant/mentors");
}
