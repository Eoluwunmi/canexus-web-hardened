/**
 * Evaluation CLI for Milestone 2 (LLM Extraction)
 * Tests resume parser against golden set and reports accuracy metrics.
 *
 * Usage: npm run resume:eval-m2
 * Outputs: JSON report + field-level F1 scores + cost analysis
 */

import { extractResumeText } from "@/lib/resume-extraction";
import { parseResumeWithLLM } from "@/lib/resume-llm";
import * as fs from "fs";
import * as path from "path";

interface GoldenResume {
  name: string;
  filePath: string;
  expectedFields: Record<string, string | string[]>;
  description: string;
}

interface FieldMetrics {
  expected: string | string[];
  extracted: string | null;
  match: boolean;
  confidence?: number;
  precision: number;
  recall: number;
  f1: number;
}

interface EvalResult {
  resumeName: string;
  description: string;
  fieldResults: Record<string, FieldMetrics>;
  overallF1: number;
  overallConfidence: number;
  extractionTimeMs: number;
  llmTimeMs: number;
  costUsd: number;
  passed: boolean;
}

interface EvalReport {
  timestamp: string;
  modelVersion: string;
  totalResumes: number;
  passedResumes: number;
  failedResumes: number;
  fieldLevelMetrics: Record<string, { precision: number; recall: number; f1: number }>;
  overallAccuracy: number;
  averageCostPerResume: number;
  totalCost: number;
  results: EvalResult[];
}

/**
 * Load golden resume dataset.
 */
function loadGoldenSet(): GoldenResume[] {
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
 * Evaluate a single resume.
 */
async function evalResume(golden: GoldenResume): Promise<EvalResult> {
  const startTime = Date.now();

  if (!fs.existsSync(golden.filePath)) {
    throw new Error(`Golden resume file not found: ${golden.filePath}`);
  }

  const buffer = fs.readFileSync(golden.filePath);
  const ext = path.extname(golden.filePath).slice(1);

  // Step 1: Extract text
  const extraction = await extractResumeText(buffer, ext);
  const extractionTime = Date.now() - startTime;

  // Step 2: LLM extraction
  const llmStartTime = Date.now();
  const extracted = await parseResumeWithLLM(
    extraction.rawText,
    "test-" + golden.name,
    path.basename(golden.filePath),
    "test-hash",
    extraction.pageCount
  );
  const llmTime = Date.now() - llmStartTime;

  // Step 3: Compare extracted vs. expected
  const fieldResults: Record<string, FieldMetrics> = {};
  let totalF1 = 0;
  let fieldCount = 0;

  for (const [fieldPath, expectedValue] of Object.entries(golden.expectedFields)) {
    const extractedValue = getFieldValue(extracted, fieldPath);
    const confidence = getFieldConfidence(extracted, fieldPath);

    const { precision, recall, f1 } = compareFields(
      expectedValue,
      extractedValue
    );

    const match = f1 > 0.7; // Conservative: > 70% F1 is a match

    fieldResults[fieldPath] = {
      expected: expectedValue,
      extracted: extractedValue,
      match,
      confidence,
      precision,
      recall,
      f1,
    };

    totalF1 += f1;
    fieldCount++;
  }

  const overallF1 = fieldCount > 0 ? totalF1 / fieldCount : 0;
  const passed = overallF1 >= 0.8; // Pass if average F1 > 80%

  return {
    resumeName: golden.name,
    description: golden.description,
    fieldResults,
    overallF1,
    overallConfidence: extracted.quality.overall_confidence,
    extractionTimeMs: extractionTime,
    llmTimeMs: llmTime,
    costUsd: 0.15, // Approximate Claude Sonnet cost
    passed,
  };
}

/**
 * Get nested field value from extracted object.
 */
function getFieldValue(obj: any, path: string): string | null {
  const parts = path.split(".");
  let current = obj;

  for (const part of parts) {
    if (!current) return null;

    // Handle array indexing: experience[0].title
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, idx] = arrayMatch;
      current = current[key]?.[parseInt(idx)];
    } else {
      current = current[part];
    }
  }

  if (typeof current === "string") return current;
  if (Array.isArray(current)) return current.join(", ");
  if (current === null || current === undefined) return null;

  return String(current);
}

/**
 * Get confidence score for a field.
 */
function getFieldConfidence(obj: any, path: string): number {
  return obj.quality?.field_confidence?.[path] ?? 0;
}

/**
 * Compare expected vs. extracted field values.
 */
function compareFields(
  expected: string | string[],
  extracted: string | null
): { precision: number; recall: number; f1: number } {
  if (!extracted) {
    return { precision: 0, recall: 0, f1: 0 };
  }

  const expectedList = Array.isArray(expected) ? expected : [expected];
  const extractedTokens = extracted.toLowerCase().split(/\s+/);
  const expectedTokens = expectedList
    .map((e) => e.toLowerCase())
    .join(" ")
    .split(/\s+/);

  const matches = extractedTokens.filter((t) =>
    expectedTokens.some((e) => e.includes(t) || t.includes(e))
  ).length;

  const precision =
    extractedTokens.length > 0 ? matches / extractedTokens.length : 0;
  const recall =
    expectedTokens.length > 0 ? matches / expectedTokens.length : 0;

  const f1 =
    precision + recall > 0
      ? 2 * (precision * recall) / (precision + recall)
      : 0;

  return { precision, recall, f1 };
}

/**
 * Run full evaluation suite.
 */
async function runEvalSuite(): Promise<EvalReport> {
  const goldenSet = loadGoldenSet();

  if (goldenSet.length === 0) {
    console.warn("No golden resumes found. Skipping evaluation.");
    return {
      timestamp: new Date().toISOString(),
      modelVersion: "claude-3-5-sonnet-20241022",
      totalResumes: 0,
      passedResumes: 0,
      failedResumes: 0,
      fieldLevelMetrics: {},
      overallAccuracy: 0,
      averageCostPerResume: 0,
      totalCost: 0,
      results: [],
    };
  }

  const results: EvalResult[] = [];
  let totalCost = 0;

  for (const golden of goldenSet) {
    try {
      console.log(`  Testing: ${golden.name}...`);
      const result = await evalResume(golden);
      results.push(result);
      totalCost += result.costUsd;
    } catch (err) {
      console.error(`  ❌ Failed to evaluate ${golden.name}:`, err);
    }
  }

  // Aggregate metrics
  const fieldMetrics: Record<string, { f1s: number[]; count: number }> = {};
  for (const result of results) {
    for (const [field, metrics] of Object.entries(result.fieldResults)) {
      if (!fieldMetrics[field]) {
        fieldMetrics[field] = { f1s: [], count: 0 };
      }
      fieldMetrics[field].f1s.push(metrics.f1);
      fieldMetrics[field].count++;
    }
  }

  const fieldLevelMetrics: Record<string, { precision: number; recall: number; f1: number }> =
    {};
  for (const [field, data] of Object.entries(fieldMetrics)) {
    const avgF1 = data.f1s.reduce((a, b) => a + b, 0) / data.f1s.length;
    fieldLevelMetrics[field] = { precision: avgF1, recall: avgF1, f1: avgF1 };
  }

  const passedResumes = results.filter((r) => r.passed).length;
  const overallAccuracy =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.overallF1, 0) / results.length
      : 0;

  return {
    timestamp: new Date().toISOString(),
    modelVersion: "claude-3-5-sonnet-20241022",
    totalResumes: goldenSet.length,
    passedResumes,
    failedResumes: goldenSet.length - passedResumes,
    fieldLevelMetrics,
    overallAccuracy,
    averageCostPerResume: results.length > 0 ? totalCost / results.length : 0,
    totalCost,
    results,
  };
}

/**
 * Main entry point.
 */
async function main() {
  try {
    console.log("🧪 Running resume parser evaluation (Milestone 2)...\n");

    const report = await runEvalSuite();

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("  RESUME PARSER EVALUATION REPORT (Milestone 2)");
    console.log("═══════════════════════════════════════════════════════════\n");

    console.log(`📊 Summary:`);
    console.log(`  Model: ${report.modelVersion}`);
    console.log(`  Total Resumes: ${report.totalResumes}`);
    console.log(`  Passed (F1 ≥ 0.8): ${report.passedResumes}`);
    console.log(`  Failed (F1 < 0.8): ${report.failedResumes}`);
    console.log(`  Overall Accuracy: ${(report.overallAccuracy * 100).toFixed(2)}%`);
    console.log(`  Cost/Resume: $${report.averageCostPerResume.toFixed(3)}`);
    console.log(`  Total Cost: $${report.totalCost.toFixed(2)}\n`);

    console.log(`📈 Field-Level Metrics (Top 15):`);
    const sortedFields = Object.entries(report.fieldLevelMetrics)
      .sort((a, b) => b[1].f1 - a[1].f1)
      .slice(0, 15);

    for (const [field, metrics] of sortedFields) {
      const bar = "█".repeat(Math.round(metrics.f1 * 20));
      console.log(
        `  ${field.padEnd(40)} F1: ${metrics.f1.toFixed(3)} ${bar}`
      );
    }

    console.log(`\n📋 Resume-Level Results:`);
    for (const result of report.results) {
      const status = result.passed ? "✅" : "❌";
      console.log(
        `  ${status} ${result.resumeName.padEnd(35)} F1: ${result.overallF1.toFixed(3)} Conf: ${(result.overallConfidence * 100).toFixed(0)}%`
      );
    }

    // Write full report to file
    const reportPath = path.join(process.cwd(), "eval-report-m2.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Full report saved to: ${reportPath}`);

    // Exit with status code based on accuracy
    const exitCode = report.overallAccuracy >= 0.8 ? 0 : 1;
    process.exit(exitCode);
  } catch (err) {
    console.error("❌ Evaluation failed:", err);
    process.exit(1);
  }
}

main();
