import { matchOccupationsForUser, OccupationMatch } from "./matching";
import { db } from "@/db";
import { userSkills, skills } from "@/db/schema";
import { eq } from "drizzle-orm";

export type CoachReply = {
  text: string;
  groundedIn: string[]; // plain-language list of data points used, for the "why am I seeing this" affordance
};

// Volume 8 / AI governance alignment:
// - There is currently no persisted conversation-history table for the AI Coach — each
//   request in src/app/api/coach/route.ts is stateless, so there is no employer-readable
//   conversation data to leak in the first place. If conversation history is ever added, it
//   MUST inherit the same access-control treatment as Passport evidence (private to the
//   applicant, never exposed via any employer-facing query or view, and its reads/writes
//   should call src/lib/audit.ts's logAudit just like src/actions/passport.ts does).
// - Every substantive reply below always returns a populated `groundedIn` array — verified
//   across all return paths (empty Passport, no LLM key configured, LLM call failed, and the
//   normal LLM-enhanced path) — never a recommendation with an empty or missing explanation.
// - Confidence labels (Low/Medium/High, from src/lib/matching.ts) are preserved through to the
//   Coach's reply in every path — see the low-confidence enforcement note further down for the
//   LLM-enhanced path specifically.

/** Builds the deterministic, explainable base recommendation from real Passport + Transferable Skills Engine data.
 *  This is what ships even without an LLM configured — the platform's explainability guarantee (PRD Vol.4)
 *  never depends on an external model being available. */
async function buildGroundedRecommendation(userId: string): Promise<{ summary: string; matches: OccupationMatch[]; skillCount: number }> {
  const held = await db
    .select({ name: skills.name })
    .from(userSkills)
    .innerJoin(skills, eq(skills.id, userSkills.skillId))
    .where(eq(userSkills.userId, userId));

  const matches = await matchOccupationsForUser(userId);
  const top = matches.slice(0, 3);

  if (held.length === 0) {
    return {
      summary:
        "Your Skills Passport is still empty, so I can't ground a recommendation in real evidence yet. Add a few skills from your work history, a project, or a certification and I'll be able to show you real, explainable career matches.",
      matches: [],
      skillCount: 0,
    };
  }

  const lines = top.map((m, i) => {
    const pct = Math.round(m.score * 100);
    const matchedNames = m.matchedSkills.slice(0, 3).map((s) => s.skillName).join(", ") || "none yet";
    const gapNames = m.gapSkills.slice(0, 3).map((s) => s.skillName).join(", ") || "none";
    return `${i + 1}. ${m.title} — ${pct}% match (${m.confidence} confidence). Matched on: ${matchedNames}. Gap skills to close: ${gapNames}.`;
  });

  const summary =
    top.length > 0
      ? `Based on the ${held.length} skill${held.length === 1 ? "" : "s"} in your Passport, here's what the Transferable Skills Engine currently ranks highest:\n\n${lines.join("\n\n")}`
      : "I don't have enough occupation data loaded yet to produce a ranked match — add more skills and check back.";

  return { summary, matches: top, skillCount: held.length };
}

export async function generateCoachReply(userId: string, userMessage: string): Promise<CoachReply> {
  const { summary, matches } = await buildGroundedRecommendation(userId);
  const groundedIn = [
    `${matches.length} occupation${matches.length === 1 ? "" : "s"} scored against your evidenced Skills Passport`,
    "Transferable Skills Engine scoring (Volume 4.2): evidence-weighted skill overlap vs. each occupation's required skills",
  ];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { text: summary, groundedIn };
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system:
          "You are the CANexus AI Career Coach. You are supportive, direct, and non-judgmental. " +
          "You must ground every substantive claim in the GROUNDED DATA block provided — never invent skills, " +
          "occupations, or scores that aren't in it. Each occupation in GROUNDED DATA carries a confidence " +
          "label (Low/Medium/High) — you must preserve that distinction rather than presenting every match " +
          "with the same certainty: explicitly flag Low or Medium confidence matches as such (e.g. 'this is a " +
          "lower-confidence match because...') instead of silently dropping the label while paraphrasing. " +
          "If the person asks about legal, immigration, or medical " +
          "topics, decline to advise and suggest a licensed professional. Keep responses concise (under 180 words).",
        messages: [
          {
            role: "user",
            content: `GROUNDED DATA:\n${summary}\n\nPERSON'S QUESTION: ${userMessage}`,
          },
        ],
      }),
    });
    if (!res.ok) return { text: summary, groundedIn };
    const data = await res.json();
    const textBlock = (data.content as { type: string; text?: string }[] | undefined)?.find((c) => c.type === "text");
    let text = textBlock?.text || summary;

    // Defensive enforcement, not just an LLM instruction: don't rely solely on the model
    // choosing to mention confidence while paraphrasing. If any top match is Low/Medium
    // confidence and the model's reply doesn't surface that anywhere, append a deterministic
    // note so a low-confidence recommendation is never silently presented as certain.
    const lowerConfidenceMatches = matches.filter((m) => m.confidence !== "High");
    if (lowerConfidenceMatches.length > 0 && !/confiden/i.test(text)) {
      const names = lowerConfidenceMatches.map((m) => `${m.title} (${m.confidence.toLowerCase()} confidence)`).join(", ");
      text += `\n\nNote: some of these are lower-confidence matches based on limited evidence in your Passport — ${names}.`;
    }

    return { text, groundedIn };
  } catch {
    return { text: summary, groundedIn };
  }
}
