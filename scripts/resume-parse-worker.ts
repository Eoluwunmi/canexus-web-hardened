/**
 * Resume Parser Worker (Milestone 2)
 * Processes queued resume parse jobs with LLM extraction.
 * Pipeline: PENDING → EXTRACTING → EXTRACTED → PARSING → COMPLETED | NEEDS_REVIEW | FAILED
 *
 * Usage: npm run resume:parse-worker
 * In production, run as a separate service/lambda with proper error handling + retries.
 */

import { db } from "@/db";
import { resumes, resumeParses, parseCosts } from "@/db/schema";
import { downloadFromS3 } from "@/lib/storage";
import { extractResumeText } from "@/lib/resume-extraction";
import { parseResumeWithLLM } from "@/lib/resume-llm";
import { logAudit } from "@/lib/audit";
import { eq } from "drizzle-orm";

const POLL_INTERVAL_MS = 5000; // Poll queue every 5 seconds
const MAX_RETRIES = 3;
const LLM_COST_PER_RESUME_USD = 0.15; // Approximate cost per resume (Claude Sonnet)

async function processParseJob(parseId: string, retryCount = 0) {
  try {
    console.log(`[${new Date().toISOString()}] Processing parse job: ${parseId}`);

    // Get parse record
    const parse = await db.query.resumeParses.findFirst({
      where: eq(resumeParses.id, parseId),
    });

    if (!parse) {
      console.error(`Parse not found: ${parseId}`);
      return;
    }

    // Get resume record
    const resume = await db.query.resumes.findFirst({
      where: eq(resumes.id, parse.resumeId),
    });

    if (!resume) {
      console.error(`Resume not found for parse: ${parseId}`);
      return;
    }

    // Update status: EXTRACTING
    await db
      .update(resumeParses)
      .set({ status: "EXTRACTING", updatedAt: new Date() })
      .where(eq(resumeParses.id, parseId));

    // Step 1: Download file from S3
    console.log(`  Downloading from S3...`);
    const fileBuffer = await downloadFromS3(resume.storageKey);

    // Step 2: Extract text
    console.log(`  Extracting text from ${resume.fileName}...`);
    const extraction = await extractResumeText(fileBuffer, resume.fileFormat);

    // Update status: EXTRACTED
    await db
      .update(resumeParses)
      .set({ status: "EXTRACTED", updatedAt: new Date() })
      .where(eq(resumeParses.id, parseId));

    // Step 3: LLM extraction (NEW in Milestone 2)
    console.log(`  Running LLM extraction (Claude Sonnet)...`);
    const startLlmTime = Date.now();

    const extractedData = await parseResumeWithLLM(
      extraction.rawText,
      parse.resumeId,
      resume.fileName,
      resume.fileHash,
      extraction.pageCount
    );

    const llmTimeMs = Date.now() - startLlmTime;
    console.log(`  LLM extraction completed in ${llmTimeMs}ms`);

    // Update status: PARSING (in progress)
    await db
      .update(resumeParses)
      .set({ status: "PARSING", updatedAt: new Date() })
      .where(eq(resumeParses.id, parseId));

    // Step 4: Determine final status based on confidence
    const overallConfidence = extractedData.quality.overall_confidence;
    const needsReview = extractedData.quality.needs_review || overallConfidence < 0.85;

    const finalStatus = needsReview ? "NEEDS_REVIEW" : "COMPLETED";

    // Step 5: Calculate costs
    const ocrCostUsd = extraction.ocrUsed ? 0.5 : 0;
    const llmCostUsd = LLM_COST_PER_RESUME_USD;
    const totalCostUsd = ocrCostUsd + llmCostUsd;

    // Step 6: Store parse results
    await db
      .update(resumeParses)
      .set({
        status: finalStatus,
        extractedData: extractedData as any,
        overallConfidence,
        fieldConfidence: extractedData.quality.field_confidence,
        needsReview,
        reviewReasons: extractedData.quality.review_reasons?.join("; ") || null,
        parsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(resumeParses.id, parseId));

    // Step 7: Store costs
    await db.insert(parseCosts).values({
      parseId,
      llmCostUsd,
      ocrCostUsd,
      totalCostUsd,
    });

    // Step 8: Audit log
    await logAudit({
      actorUserId: resume.uploadedByUserId,
      action: "RESUME_PARSED",
      targetResource: "resume_parse",
      metadata: {
        parseId,
        resumeId: resume.id,
        extractionMethod: extraction.method,
        pageCount: extraction.pageCount,
        llmTimeMs,
        overallConfidence,
        status: finalStatus,
        costUsd: totalCostUsd,
      },
    });

    console.log(
      `  ✅ Parse completed: ${finalStatus} (confidence: ${(overallConfidence * 100).toFixed(1)}%, cost: $${totalCostUsd.toFixed(2)})`
    );
  } catch (err) {
    console.error(`❌ Error processing parse ${parseId}:`, err);

    const errorMsg = err instanceof Error ? err.message : String(err);

    // Implement retry logic with exponential backoff
    if (retryCount < MAX_RETRIES) {
      const backoffMs = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.log(`  Retrying in ${backoffMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      return processParseJob(parseId, retryCount + 1);
    }

    // Final failure after all retries
    await db
      .update(resumeParses)
      .set({
        status: "FAILED",
        errorMessage: errorMsg,
        updatedAt: new Date(),
      })
      .where(eq(resumeParses.id, parseId));

    // Audit the failure
    const resume = await db.query.resumes.findFirst({
      where: eq(resumes.id, (await db.query.resumeParses.findFirst({ where: eq(resumeParses.id, parseId) }))?.resumeId || ""),
    });

    if (resume) {
      await logAudit({
        actorUserId: resume.uploadedByUserId,
        action: "RESUME_PARSE_FAILED",
        targetResource: "resume_parse",
        metadata: {
          parseId,
          resumeId: resume.id,
          error: errorMsg,
          retries: MAX_RETRIES,
        },
      });
    }
  }
}

async function pollQueue() {
  try {
    // Find all pending parses
    const pendingParses = await db.query.resumeParses.findMany({
      where: eq(resumeParses.status, "PENDING"),
      limit: 5, // Process 5 at a time to avoid thundering herd
    });

    if (pendingParses.length === 0) {
      // Only log occasionally to reduce noise
      if (Math.random() < 0.1) {
        console.log(`[${new Date().toISOString()}] No pending parses.`);
      }
      return;
    }

    console.log(
      `[${new Date().toISOString()}] Found ${pendingParses.length} pending parse(s), processing...`
    );

    // Process parses sequentially to avoid rate limiting
    for (const parse of pendingParses) {
      if (parse.id) {
        await processParseJob(parse.id);
      }
    }
  } catch (err) {
    console.error("Error polling queue:", err);
  }
}

async function main() {
  console.log("🚀 Resume Parser Worker starting (Milestone 2)...");
  console.log(`   Polling interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`   Max retries: ${MAX_RETRIES}`);
  console.log(`   LLM model: Claude Sonnet`);
  console.log(`   Estimated cost: $${LLM_COST_PER_RESUME_USD}/resume\n`);

  // Poll indefinitely
  let pollCount = 0;
  while (true) {
    pollCount++;
    if (pollCount % 12 === 0) {
      // Log status every ~60s
      console.log(
        `[${new Date().toISOString()}] Worker alive (${pollCount} poll cycles)`
      );
    }

    await pollQueue();
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n🛑 SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n🛑 SIGINT received, shutting down...");
  process.exit(0);
});

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
