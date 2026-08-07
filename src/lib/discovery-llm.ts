/**
 * LLM-based skill extraction from experience narrative using Claude Sonnet.
 * Analyzes user's natural language description of projects/roles to extract skills.
 * Returns skills with confidence scores and supporting evidence snippets.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface DiscoveredSkill {
  skillName: string;
  proficiencyLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
  confidence: number; // 0-1, Claude's confidence in the extraction
  evidenceSnippet: string; // Exact quote from narrative supporting the skill
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  return new Anthropic({ apiKey });
}

function buildExtractionPrompt(
  narrative: string,
  narrativeMetadata?: Record<string, any>
): string {
  const metadataContext = narrativeMetadata
    ? `
Additional context provided by user:
- Project type: ${narrativeMetadata.projectType || "not specified"}
- Timeline: ${narrativeMetadata.timeline || "not specified"}
- Team size: ${narrativeMetadata.teamSize || "not specified"}
- Industry: ${narrativeMetadata.industry || "not specified"}
- Technologies mentioned: ${narrativeMetadata.technologies || "not specified"}
`
    : "";

  return `You are an expert career coach analyzing a candidate's experience narrative to extract skills.

User's Experience Narrative:
${narrative}
${metadataContext}

Extract all skills explicitly mentioned or strongly implied by the narrative. For each skill:
1. Identify the skill name (e.g., Python, Project Management, Data Analysis)
2. Assess proficiency level based on context (BEGINNER, INTERMEDIATE, ADVANCED, EXPERT)
3. Rate confidence (0.0-1.0) in the extraction based on clarity of evidence
4. Quote the exact text from the narrative that supports this skill

Return ONLY valid JSON (no markdown, no extra text). Example format:
{
  "skills": [
    {
      "skillName": "Python",
      "proficiencyLevel": "ADVANCED",
      "confidence": 0.95,
      "evidenceSnippet": "I built a Python web scraper that processed 10M records daily"
    }
  ]
}

Rules:
- Extract 5-20 skills (more if narrative is detailed)
- Confidence should reflect how clearly the skill is demonstrated
- Evidence snippet should be a direct quote, no paraphrasing
- Include both hard skills (Python, SQL) and soft skills (Leadership, Communication)
- Normalize skill names to common industry terms (e.g., "JS" → "JavaScript")
- If a skill is mentioned multiple times at different levels, use the highest proficiency demonstrated
- Sort by confidence descending`;
}

/**
 * Extract skills from experience narrative using Claude Sonnet.
 * Narrative can be combined with optional metadata about project type, team size, etc.
 */
export async function extractSkillsFromNarrative(
  narrative: string,
  narrativeMetadata?: Record<string, any>
): Promise<DiscoveredSkill[]> {
  if (!narrative || narrative.trim().length === 0) {
    return [];
  }

  const client = getClient();
  const prompt = buildExtractionPrompt(narrative, narrativeMetadata);

  try {
    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    let extractedJson: any;
    try {
      extractedJson = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        extractedJson = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error("Failed to parse LLM response as JSON");
      }
    }

    const skills: DiscoveredSkill[] = (extractedJson.skills || [])
      .map((s: any) => ({
        skillName: (s.skillName || "").trim(),
        proficiencyLevel: validateProficiencyLevel(s.proficiencyLevel),
        confidence: Math.max(0, Math.min(1, parseFloat(s.confidence) || 0.5)),
        evidenceSnippet: (s.evidenceSnippet || "").trim(),
      }))
      .filter((s: DiscoveredSkill) => s.skillName.length > 0);

    return skills;
  } catch (error) {
    console.error("Error extracting skills from narrative:", error);
    throw error;
  }
}

function validateProficiencyLevel(
  level: any
): "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT" {
  const normalized = String(level).toUpperCase();
  if (["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"].includes(normalized)) {
    return normalized as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
  }
  return "INTERMEDIATE"; // Default
}
