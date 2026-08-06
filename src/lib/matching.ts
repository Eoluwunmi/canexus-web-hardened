import { db } from "@/db";
import { occupations, occupationSkills, skills, userSkills, jobs, jobSkills } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

const verificationWeight: Record<string, number> = {
  SELF_REPORTED: 0.5,
  EVIDENCE_LINKED: 0.8,
  VERIFIED: 1.0,
};

export type SkillMatch = {
  skillId: string;
  skillName: string;
  importance: number;
  held: boolean;
  verificationLevel?: string;
};

export type OccupationMatch = {
  occupationId: string;
  title: string;
  nocCode: string | null;
  score: number; // 0-1
  confidence: "Low" | "Medium" | "High";
  matchedSkills: SkillMatch[];
  gapSkills: SkillMatch[];
};

/** Core Transferable Skills Engine: ranks occupations against a user's evidenced Skills Passport. */
export async function matchOccupationsForUser(userId: string): Promise<OccupationMatch[]> {
  const held = await db
    .select({ skillId: userSkills.skillId, verificationLevel: userSkills.verificationLevel })
    .from(userSkills)
    .where(eq(userSkills.userId, userId));

  const heldMap = new Map(held.map((h) => [h.skillId, h.verificationLevel]));

  const occs = await db.select().from(occupations);
  const results: OccupationMatch[] = [];

  for (const occ of occs) {
    const reqSkills = await db
      .select({
        skillId: occupationSkills.skillId,
        importance: occupationSkills.importance,
        name: skills.name,
      })
      .from(occupationSkills)
      .innerJoin(skills, eq(skills.id, occupationSkills.skillId))
      .where(eq(occupationSkills.occupationId, occ.id));

    if (reqSkills.length === 0) continue;

    let totalWeight = 0;
    let earnedWeight = 0;
    let evidenceSum = 0;
    let evidenceCount = 0;
    const matched: SkillMatch[] = [];
    const gaps: SkillMatch[] = [];

    for (const rs of reqSkills) {
      totalWeight += rs.importance;
      const level = heldMap.get(rs.skillId);
      if (level) {
        const w = verificationWeight[level] ?? 0.5;
        earnedWeight += rs.importance * w;
        evidenceSum += w;
        evidenceCount += 1;
        matched.push({ skillId: rs.skillId, skillName: rs.name, importance: rs.importance, held: true, verificationLevel: level });
      } else {
        gaps.push({ skillId: rs.skillId, skillName: rs.name, importance: rs.importance, held: false });
      }
    }

    const score = totalWeight > 0 ? earnedWeight / totalWeight : 0;
    const avgEvidence = evidenceCount > 0 ? evidenceSum / evidenceCount : 0;
    const confidence: OccupationMatch["confidence"] =
      matched.length < 2 ? "Low" : avgEvidence >= 0.8 ? "High" : avgEvidence >= 0.6 ? "Medium" : "Low";

    results.push({
      occupationId: occ.id,
      title: occ.title,
      nocCode: occ.nocCode,
      score,
      confidence,
      matchedSkills: matched.sort((a, b) => b.importance - a.importance),
      gapSkills: gaps.sort((a, b) => b.importance - a.importance),
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

export type CandidateMatch = {
  userId: string;
  name: string;
  score: number;
  matchedSkills: SkillMatch[];
  gapSkills: SkillMatch[];
};

/** Employer Candidate Search ranking: scores applicants against a specific job's required/preferred skills. */
export async function matchCandidatesForJob(jobId: string): Promise<CandidateMatch[]> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) return [];

  const reqSkills = await db
    .select({ skillId: jobSkills.skillId, requirementType: jobSkills.requirementType, name: skills.name })
    .from(jobSkills)
    .innerJoin(skills, eq(skills.id, jobSkills.skillId))
    .where(eq(jobSkills.jobId, jobId));

  if (reqSkills.length === 0) return [];

  const skillIds = reqSkills.map((r) => r.skillId);
  const candidateRows = await db
    .select({
      userId: userSkills.userId,
      skillId: userSkills.skillId,
      verificationLevel: userSkills.verificationLevel,
      visibility: userSkills.visibility,
    })
    .from(userSkills)
    .where(inArray(userSkills.skillId, skillIds));

  const byUser = new Map<string, typeof candidateRows>();
  for (const row of candidateRows) {
    if (row.visibility === "PRIVATE") continue; // respect Passport visibility (Volume 8.5)
    if (!byUser.has(row.userId)) byUser.set(row.userId, []);
    byUser.get(row.userId)!.push(row);
  }

  const { users } = await import("@/db/schema");
  const results: CandidateMatch[] = [];

  for (const [userId, rows] of byUser) {
    // Exclude soft-deleted accounts from candidate search (Volume 6.3 / right to erasure —
    // a deleted user must not remain discoverable by employers).
    const [candidateUser] = await db
      .select({ name: users.name, status: users.status })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!candidateUser || candidateUser.status !== "ACTIVE") continue;

    const heldMap = new Map(rows.map((r) => [r.skillId, r.verificationLevel]));
    let totalWeight = 0;
    let earnedWeight = 0;
    const matched: SkillMatch[] = [];
    const gaps: SkillMatch[] = [];

    for (const rs of reqSkills) {
      const weight = rs.requirementType === "REQUIRED" ? 2 : 1;
      totalWeight += weight;
      const level = heldMap.get(rs.skillId);
      if (level) {
        earnedWeight += weight * (verificationWeight[level] ?? 0.5);
        matched.push({ skillId: rs.skillId, skillName: rs.name, importance: weight, held: true, verificationLevel: level });
      } else {
        gaps.push({ skillId: rs.skillId, skillName: rs.name, importance: weight, held: false });
      }
    }

    results.push({
      userId,
      name: candidateUser.name,
      score: totalWeight > 0 ? earnedWeight / totalWeight : 0,
      matchedSkills: matched.sort((a, b) => b.importance - a.importance),
      gapSkills: gaps,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
