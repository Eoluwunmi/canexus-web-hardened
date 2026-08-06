/**
 * Evaluation CLI: Run the golden set evaluation.
 * Usage: npm run resume:eval
 * Outputs: JSON report to stdout + baseline comparison
 */

import { runEvalSuite } from "@/lib/resume-eval";
import * as fs from "fs";
import * as path from "path";

async function main() {
  try {
    console.log("🧪 Running resume parser evaluation...\n");

    const report = await runEvalSuite();

    console.log("═══════════════════════════════════════════");
    console.log("  RESUME PARSER EVALUATION REPORT");
    console.log("═══════════════════════════════════════════\n");

    console.log(`📊 Summary:`);
    console.log(`  Total Resumes: ${report.totalResumes}`);
    console.log(`  Passed (F1 ≥ 0.9): ${report.passedResumes}`);
    console.log(`  Failed (F1 < 0.9): ${report.failedResumes}`);
    console.log(`  Overall Accuracy: ${(report.overallAccuracy * 100).toFixed(2)}%\n`);

    console.log(`📈 Field-Level Metrics (Top 10):`);
    const sortedFields = Object.entries(report.fieldLevelMetrics)
      .sort((a, b) => b[1].f1 - a[1].f1)
      .slice(0, 10);

    for (const [field, metrics] of sortedFields) {
      console.log(`  ${field.padEnd(40)} F1: ${metrics.f1.toFixed(3)}`);
    }

    if (report.regressions.length > 0) {
      console.log(`\n⚠️  Regressions detected (${report.regressions.length}):`);
      for (const regression of report.regressions) {
        console.log(`  - ${regression}`);
      }
    }

    // Write full report to file
    const reportPath = path.join(process.cwd(), "eval-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Full report saved to: ${reportPath}`);

    // Exit with status code based on accuracy
    const exitCode = report.overallAccuracy >= 0.9 ? 0 : 1;
    process.exit(exitCode);
  } catch (err) {
    console.error("❌ Evaluation failed:", err);
    process.exit(1);
  }
}

main();
