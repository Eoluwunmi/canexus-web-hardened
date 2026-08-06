/**
 * Evaluation harness for resume parser.
 * Measures field-level precision/recall/F1 against golden set.
 * Run via: npm run eval
 */

import { extractResumeText } from "./resume-extraction";
import * as fs from "fs";
import * as path from "path";

export interface GoldenResume {
  name: string;
  filePath: string;
  expectedFields: Record<string, string | string[]>; // { "identity.full_name": "John Doe", ... }
  description: string; // e.g., "Multi-column layout, 2-page CV"
}

export interface EvalResult {
  resumeName: string;
  fieldResults: Record<
    string,
    {
      expected: string | string[];
      extracted: string | null;
      match: boolean;
      precision?: number;
      recall?: number;
      f1?: number;
    }
  >;
  overallF1: number;
  extractionTimeMs: number;
}

export interface EvalReport {
  timestamp: string;
  totalResumes: number;
  passedResumes: number;
  failedResumes: number;
  fieldLevelMetrics: Record<string, { precision: number; recall: number; f1: number }>;
  overallAccuracy: number;
  regressions: string[]; // Fields that regressed since last run
  results: EvalResult[];
}

/**
 * Load golden resume dataset from disk.
 * Each golden resume is a .json file in tests/golden-resumes/
 */
export async function loadGoldenSet(): Promise<GoldenResume[]> {
  const goldenDir = path.join(process.cwd(), "tests", "golden-resumes");

  if (!fs.existsSync(goldenDir)) {
    console.warn(`Golden set directory not found: ${goldenDir}`);
    return [];
  }

  const files = fs.readdirSync(goldenDir).filter((f) => f.endsWith(".json"));
  const resumes: GoldenResume[] = [];

  for (const file of files) {
    const meta = JSON.parse(fs.readFileSync(path.join(goldenDir, file), "utf-8"));
    const baseDir = path.dirname(path.join(goldenDir, file));

    resumes.push({
      name: path.basename(file, ".json"),
      filePath: path.join(baseDir, meta.filePath),
      expectedFields: meta.expectedFields,
      description: meta.description || "",
    });
  }

  return resumes;
}

/**
 * Run evaluation on a single golden resume.
 */
export async function evalResume(golden: GoldenResume): Promise<EvalResult> {
  const startTime = Date.now();

  // Read resume file
  if (!fs.existsSync(golden.filePath)) {
    throw new Error(`Golden resume file not found: ${golden.filePath}`);
  }

  const buffer = fs.readFileSync(golden.filePath);
  const ext = path.extname(golden.filePath).slice(1);

  // Extract text
  const extraction = await extractResumeText(buffer, ext);

  // Parse extracted text to structured fields (this is a stub; real version uses LLM)
  const extractedFields = parseExtractedFields(extraction.rawText);

  // Compare extracted vs. expected
  const fieldResults: EvalResult["fieldResults"] = {};
  let totalF1 = 0;
  let fieldCount = 0;

  for (const [fieldPath, expected] of Object.entries(golden.expectedFields)) {
    const extracted = extractedFields[fieldPath] || null;
    const match = compareFieldValues(expected, extracted);

    const { precision, recall, f1 } = calculateMetrics(
      typeof expected === "string" ? [expected] : expected,
      extracted ? [extracted] : []
    );

    fieldResults[fieldPath] = {
      expected,
      extracted,
      match,
      precision,
      recall,
      f1,
    };

    totalF1 += f1;
    fieldCount++;
  }

  return {
    resumeName: golden.name,
    fieldResults,
    overallF1: fieldCount > 0 ? totalF1 / fieldCount : 0,
    extractionTimeMs: Date.now() - startTime,
  };
}

/**
 * Stub function: parse extracted text into structured fields.
 * In production, this is handled by the LLM extraction step.
 */
function parseExtractedFields(text: string): Record<string, string> {
  // Placeholder: extract basic fields from raw text
  const fields: Record<string, string> = {};

  // Extract email
  const emailMatch = text.match(/([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
  if (emailMatch) {
    fields["identity.emails[0]"] = emailMatch[0];
  }

  // Extract phone (simplified)
  const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?\(?)\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) {
    fields["identity.phones[0].e164"] = phoneMatch[0].replace(/\D/g, "");
  }

  // Extract name (first line usually)
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (!firstLine.includes("@") && firstLine.length < 100) {
      fields["identity.full_name"] = firstLine;
    }
  }

  return fields;
}

/**
 * Compare expected vs. extracted field values.
 */
function compareFieldValues(
  expected: string | string[],
  extracted: string | null
): boolean {
  if (!extracted) return false;
  const expectedList = Array.isArray(expected) ? expected : [expected];
  return expectedList.some((e) => e.toLowerCase().includes(extracted.toLowerCase()));
}

/**
 * Calculate precision, recall, F1 for a field.
 */
function calculateMetrics(
  expected: string[],
  extracted: string[]
): { precision: number; recall: number; f1: number } {
  if (extracted.length === 0) {
    return { precision: 0, recall: 0, f1: 0 };
  }

  const matches = extracted.filter((e) =>
    expected.some((x) => x.toLowerCase().includes(e.toLowerCase()))
  ).length;

  const precision = matches / extracted.length;
  const recall = expected.length > 0 ? matches / expected.length : 0;
  const f1 = 2 * (precision * recall) / (precision + recall || 1);

  return { precision, recall, f1 };
}

/**
 * Run full evaluation suite.
 */
export async function runEvalSuite(): Promise<EvalReport> {
  const goldenSet = await loadGoldenSet();

  if (goldenSet.length === 0) {
    console.warn("No golden resumes found. Skipping evaluation.");
    return {
      timestamp: new Date().toISOString(),
      totalResumes: 0,
      passedResumes: 0,
      failedResumes: 0,
      fieldLevelMetrics: {},
      overallAccuracy: 0,
      regressions: [],
      results: [],
    };
  }

  const results: EvalResult[] = [];

  for (const golden of goldenSet) {
    try {
      console.log(`Evaluating: ${golden.name}...`);
      const result = await evalResume(golden);
      results.push(result);
    } catch (err) {
      console.error(`Failed to evaluate ${golden.name}:`, err);
    }
  }

  // Aggregate metrics
  const fieldMetrics: Record<string, { f1s: number[]; count: number }> = {};
  for (const result of results) {
    for (const [field, metrics] of Object.entries(result.fieldResults)) {
      if (!fieldMetrics[field]) {
        fieldMetrics[field] = { f1s: [], count: 0 };
      }
      fieldMetrics[field].f1s.push(metrics.f1 || 0);
      fieldMetrics[field].count++;
    }
  }

  const fieldLevelMetrics: Record<string, { precision: number; recall: number; f1: number }> =
    {};
  for (const [field, data] of Object.entries(fieldMetrics)) {
    const avgF1 = data.f1s.reduce((a, b) => a + b, 0) / data.f1s.length;
    fieldLevelMetrics[field] = { precision: avgF1, recall: avgF1, f1: avgF1 };
  }

  const passedResumes = results.filter((r) => r.overallF1 >= 0.9).length;
  const overallAccuracy =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.overallF1, 0) / results.length
      : 0;

  return {
    timestamp: new Date().toISOString(),
    totalResumes: goldenSet.length,
    passedResumes,
    failedResumes: goldenSet.length - passedResumes,
    fieldLevelMetrics,
    overallAccuracy,
    regressions: [], // TODO: Compare against last baseline
    results,
  };
}
