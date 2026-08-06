/**
 * LLM-based resume extraction using Claude Sonnet.
 * Parses raw extracted text into structured resume fields.
 * Includes confidence scoring and error handling.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface ParsedResume {
  candidate_id: string;
  source: {
    file_id: string;
    filename: string;
    sha256: string;
    pages: number;
    extraction_method: "native" | "ocr" | "hybrid";
  };
  identity: {
    full_name: string | null;
    given_name: string | null;
    family_name: string | null;
    emails: string[];
    phones: Array<{ e164: string; type?: string }>;
    location: {
      city: string | null;
      region: string | null;
      country: string | null;
      raw: string | null;
    };
    links: Array<{ type: string; url: string }>;
  };
  work_authorization: {
    stated: string | null;
    raw_text: string | null;
  };
  summary: string | null;
  experience: Array<{
    employer: string | null;
    normalized_employer_id: string | null;
    title: string | null;
    normalized_title: string | null;
    seniority: string | null;
    employment_type: string | null;
    location: string | null;
    start: string | null; // YYYY-MM
    end: string | null; // YYYY-MM or "present"
    duration_months: number | null;
    is_current: boolean;
    bullets: string[];
    technologies: string[];
    achievements_quantified: string[];
  }>;
  education: Array<{
    institution: string | null;
    credential: string | null;
    field_of_study: string | null;
    start: string | null;
    end: string | null;
    gpa: number | null;
    honors: string[];
  }>;
  skills: Array<{
    name: string;
    canonical_id: string | null;
    category: string | null;
    evidence_span_ids: string[];
    inferred: boolean;
    years_experience: number | null;
    last_used_year: number | null;
  }>;
  certifications: Array<{
    name: string;
    issuer: string | null;
    issued: string | null;
    expires: string | null;
    credential_id: string | null;
  }>;
  languages: Array<{
    name: string;
    proficiency: string | null; // Native, Fluent, Conversational, etc.
  }>;
  publications: Array<{
    title: string;
    authors: string[];
    published_at: string | null;
    url: string | null;
  }>;
  projects: Array<{
    name: string;
    description: string;
    url: string | null;
    technologies: string[];
  }>;
  volunteer: Array<{
    organization: string;
    role: string;
    start: string | null;
    end: string | null;
    description: string;
  }>;
  awards: Array<{
    title: string;
    issuer: string;
    issued_at: string | null;
    description: string;
  }>;
  derived: {
    total_experience_months: number;
    experience_by_skill: Record<string, number>; // skill -> months
    employment_gaps: Array<{
      start: string;
      end: string;
      months: number;
    }>;
    average_tenure_months: number;
    career_trajectory: "ascending" | "lateral" | "mixed" | "unknown";
  };
  quality: {
    field_confidence: Record<string, number>; // field_path -> 0-1 confidence
    overall_confidence: number; // 0-1
    needs_review: boolean;
    review_reasons: string[];
  };
}

interface FieldConfidence {
  [key: string]: number;
}

const client = new Anthropic();

/**
 * Extraction prompt for Claude.
 * Instructs the model to parse resume text into structured JSON.
 */
function buildExtractionPrompt(rawText: string): string {
  return `You are a resume parsing expert. Extract structured data from this resume text.

IMPORTANT RULES:
1. Extract ONLY information explicitly stated in the text. Never invent data.
2. For missing fields, use null (not empty string or 0).
3. Dates must be in YYYY-MM format. If only year is given, use YYYY-01.
4. Phones must be in E.164 format (e.g., +16135551234).
5. For each field, include a confidence score (0-1) in the JSON.
6. Mark inferred fields (e.g., "JavaScript" inferred from "Node.js") with "inferred": true.
7. Keep arrays empty [] if no data found, not null.

Resume text:
---
${rawText}
---

Return ONLY valid JSON (no markdown, no explanations). Include field_confidence for each extracted field.

{
  "identity": {
    "full_name": "string | null",
    "emails": ["string"],
    "phones": [{"e164": "string", "type": "string | null"}],
    "location": {
      "city": "string | null",
      "region": "string | null",
      "country": "string | null"
    }
  },
  "summary": "string | null",
  "experience": [
    {
      "employer": "string | null",
      "title": "string | null",
      "start": "YYYY-MM | null",
      "end": "YYYY-MM | 'present' | null",
      "is_current": false,
      "bullets": ["string"],
      "technologies": ["string"]
    }
  ],
  "education": [
    {
      "institution": "string | null",
      "credential": "string | null",
      "field_of_study": "string | null",
      "start": "YYYY-MM | null",
      "end": "YYYY-MM | null"
    }
  ],
  "skills": [
    {
      "name": "string",
      "category": "string | null",
      "inferred": false
    }
  ],
  "languages": [
    {
      "name": "string",
      "proficiency": "string | null"
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string | null"
    }
  ],
  "field_confidence": {
    "identity.full_name": 0.95,
    "identity.emails[0]": 0.98,
    ...
  },
  "overall_confidence": 0.92
}`;
}

/**
 * Parse resume text using Claude Sonnet.
 * Returns structured data with confidence scores.
 */
export async function parseResumeWithLLM(
  rawText: string,
  resumeId: string,
  filename: string,
  fileHash: string,
  pageCount: number
): Promise<ParsedResume> {
  const prompt = buildExtractionPrompt(rawText);

  try {
    // Call Claude Sonnet with structured output
    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract JSON from response
    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse JSON (handle potential markdown wrappers)
    let extractedJson: any;
    try {
      // Try direct parse first
      extractedJson = JSON.parse(responseText);
    } catch {
      // Try extracting from markdown code block
      const jsonMatch = responseText.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        extractedJson = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error("Failed to parse LLM response as JSON");
      }
    }

    // Build structured resume object
    const parsed: ParsedResume = {
      candidate_id: resumeId,
      source: {
        file_id: resumeId,
        filename,
        sha256: fileHash,
        pages: pageCount,
        extraction_method: "native",
      },
      identity: {
        full_name: extractedJson.identity?.full_name ?? null,
        given_name: null,
        family_name: null,
        emails: extractedJson.identity?.emails ?? [],
        phones: extractedJson.identity?.phones ?? [],
        location: extractedJson.identity?.location ?? {
          city: null,
          region: null,
          country: null,
          raw: null,
        },
        links: extractedJson.identity?.links ?? [],
      },
      work_authorization: {
        stated: extractedJson.work_authorization?.stated ?? null,
        raw_text: null,
      },
      summary: extractedJson.summary ?? null,
      experience: (extractedJson.experience ?? []).map((exp: any) => ({
        employer: exp.employer ?? null,
        normalized_employer_id: null,
        title: exp.title ?? null,
        normalized_title: null,
        seniority: inferSeniority(exp.title),
        employment_type: exp.employment_type ?? null,
        location: exp.location ?? null,
        start: validateDate(exp.start),
        end: validateDate(exp.end),
        duration_months: calculateDuration(exp.start, exp.end),
        is_current: exp.end === "present" || exp.is_current === true,
        bullets: exp.bullets ?? [],
        technologies: exp.technologies ?? [],
        achievements_quantified: exp.achievements_quantified ?? [],
      })),
      education: (extractedJson.education ?? []).map((edu: any) => ({
        institution: edu.institution ?? null,
        credential: edu.credential ?? null,
        field_of_study: edu.field_of_study ?? null,
        start: validateDate(edu.start),
        end: validateDate(edu.end),
        gpa: edu.gpa ?? null,
        honors: edu.honors ?? [],
      })),
      skills: (extractedJson.skills ?? []).map((skill: any) => ({
        name: skill.name,
        canonical_id: normalizeSkillId(skill.name),
        category: skill.category ?? null,
        evidence_span_ids: skill.evidence_span_ids ?? [],
        inferred: skill.inferred ?? false,
        years_experience: null,
        last_used_year: null,
      })),
      certifications: extractedJson.certifications ?? [],
      languages: extractedJson.languages ?? [],
      publications: extractedJson.publications ?? [],
      projects: extractedJson.projects ?? [],
      volunteer: extractedJson.volunteer ?? [],
      awards: extractedJson.awards ?? [],
      derived: {
        total_experience_months: calculateTotalExperience(extractedJson.experience),
        experience_by_skill: {},
        employment_gaps: [],
        average_tenure_months: 0,
        career_trajectory: inferCareerTrajectory(extractedJson.experience),
      },
      quality: {
        field_confidence: extractedJson.field_confidence ?? {},
        overall_confidence: extractedJson.overall_confidence ?? 0,
        needs_review: (extractedJson.overall_confidence ?? 0) < 0.85,
        review_reasons: [],
      },
    };

    // Calculate derived metrics
    parsed.derived.total_experience_months = calculateTotalExperience(
      parsed.experience
    );
    parsed.derived.employment_gaps = findEmploymentGaps(parsed.experience);
    parsed.derived.average_tenure_months = calculateAverageTenure(
      parsed.experience
    );

    return parsed;
  } catch (err) {
    console.error("LLM extraction error:", err);
    throw new Error(`Failed to parse resume with LLM: ${err}`);
  }
}

/**
 * Validate and standardize date format (YYYY-MM).
 */
function validateDate(date: string | null): string | null {
  if (!date) return null;

  // Handle "present"
  if (date.toLowerCase() === "present") return "present";

  // Try parsing YYYY-MM-DD, YYYY-MM, YYYY, or MM/DD/YYYY formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{4})-(\d{2})$/, // YYYY-MM
    /^(\d{4})$/, // YYYY
    /^(\d{1,2})\/(\d{4})$/, // MM/YYYY
  ];

  for (const format of formats) {
    const match = date.match(format);
    if (match) {
      if (format.source.includes("-")) {
        // Already YYYY-MM-DD or YYYY-MM
        return match[0].slice(0, 7); // Return YYYY-MM
      } else if (match[0].length === 4) {
        // Just year
        return `${match[0]}-01`;
      } else if (format.source.includes("/")) {
        // MM/YYYY
        return `${match[2]}-${match[1].padStart(2, "0")}`;
      }
    }
  }

  return null; // Invalid date format
}

/**
 * Calculate duration in months between start and end dates.
 */
function calculateDuration(start: string | null, end: string | null): number | null {
  if (!start) return null;

  const startDate = parseDate(start);
  if (!startDate) return null;

  const endDate = end === "present" ? new Date() : parseDate(end);
  if (!endDate) return null;

  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());

  return Math.max(0, months);
}

/**
 * Parse date string to Date object.
 */
function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const [year, month] = dateStr.split("-").map(Number);
  return new Date(year, (month || 1) - 1, 1);
}

/**
 * Infer seniority level from job title.
 */
function inferSeniority(title: string | null): string | null {
  if (!title) return null;

  const titleLower = title.toLowerCase();

  if (titleLower.includes("intern") || titleLower.includes("junior")) {
    return "junior";
  } else if (
    titleLower.includes("senior") ||
    titleLower.includes("lead") ||
    titleLower.includes("principal")
  ) {
    return "senior";
  } else if (titleLower.includes("manager") || titleLower.includes("director")) {
    return "manager";
  } else if (titleLower.includes("executive") || titleLower.includes("c-level")) {
    return "executive";
  }

  return null;
}

/**
 * Normalize skill name to canonical ID.
 * Maps common variations (Python, python, PYTHON) to canonical form.
 */
function normalizeSkillId(skillName: string): string | null {
  if (!skillName) return null;

  const skillMap: Record<string, string> = {
    // Programming languages
    python: "python",
    javascript: "javascript",
    js: "javascript",
    typescript: "typescript",
    ts: "typescript",
    java: "java",
    csharp: "csharp",
    "c#": "csharp",
    cpp: "cpp",
    "c++": "cpp",
    rust: "rust",
    go: "go",
    golang: "go",
    ruby: "ruby",
    php: "php",
    swift: "swift",
    kotlin: "kotlin",

    // Web/Frontend
    react: "react",
    vue: "vue",
    angular: "angular",
    html: "html",
    css: "css",
    tailwind: "tailwind",
    "next.js": "nextjs",
    nextjs: "nextjs",

    // Databases
    sql: "sql",
    postgres: "postgres",
    postgresql: "postgres",
    mysql: "mysql",
    mongodb: "mongodb",
    redis: "redis",

    // Tools
    git: "git",
    docker: "docker",
    kubernetes: "kubernetes",
    aws: "aws",
    "amazon web services": "aws",
    gcp: "gcp",
    "google cloud": "gcp",
    azure: "azure",

    // Soft skills
    communication: "communication",
    leadership: "leadership",
    teamwork: "teamwork",
    "problem solving": "problem_solving",
    "critical thinking": "critical_thinking",
  };

  const normalized = skillName.toLowerCase().trim();
  return skillMap[normalized] || normalized;
}

/**
 * Calculate total months of experience.
 */
function calculateTotalExperience(
  experience: Array<{ start: string | null; end: string | null }>
): number {
  return experience.reduce((total, exp) => {
    return total + (calculateDuration(exp.start, exp.end) ?? 0);
  }, 0);
}

/**
 * Find employment gaps (> 3 months).
 */
function findEmploymentGaps(
  experience: Array<{
    start: string | null;
    end: string | null;
    is_current?: boolean;
  }>
): Array<{ start: string; end: string; months: number }> {
  if (experience.length < 2) return [];

  // Sort by start date
  const sorted = [...experience]
    .filter((e) => e.start && e.end)
    .sort(
      (a, b) =>
        new Date(a.start!).getTime() - new Date(b.start!).getTime()
    );

  const gaps: Array<{ start: string; end: string; months: number }> = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    const currentEndDate = parseDate(current.end!);
    const nextStartDate = parseDate(next.start!);

    if (currentEndDate && nextStartDate) {
      const gapMonths =
        (nextStartDate.getFullYear() - currentEndDate.getFullYear()) * 12 +
        (nextStartDate.getMonth() - currentEndDate.getMonth());

      if (gapMonths > 3) {
        gaps.push({
          start: current.end!,
          end: next.start!,
          months: gapMonths,
        });
      }
    }
  }

  return gaps;
}

/**
 * Calculate average tenure across roles.
 */
function calculateAverageTenure(
  experience: Array<{ start: string | null; end: string | null }>
): number {
  if (experience.length === 0) return 0;

  const durations = experience
    .map((exp) => calculateDuration(exp.start, exp.end) ?? 0)
    .filter((d) => d > 0);

  if (durations.length === 0) return 0;

  return Math.round(durations.reduce((a, b) => a + b) / durations.length);
}

/**
 * Infer career trajectory from experience.
 */
function inferCareerTrajectory(
  experience: Array<{ title: string | null; seniority?: string | null }>
): "ascending" | "lateral" | "mixed" | "unknown" {
  if (experience.length < 2) return "unknown";

  const seniorityOrder = ["intern", "junior", "mid", "senior", "manager", "executive"];

  let ascending = 0;
  let lateral = 0;
  let descending = 0;

  for (let i = 0; i < experience.length - 1; i++) {
    const current = inferSeniority(experience[i].title) || "mid";
    const next = inferSeniority(experience[i + 1].title) || "mid";

    const currentIdx = seniorityOrder.indexOf(current);
    const nextIdx = seniorityOrder.indexOf(next);

    if (nextIdx > currentIdx) ascending++;
    else if (nextIdx === currentIdx) lateral++;
    else descending++;
  }

  if (ascending > lateral + descending) return "ascending";
  if (lateral >= ascending && lateral >= descending) return "lateral";
  if (descending > 0) return "mixed";

  return "unknown";
}
