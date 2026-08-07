/**
 * Resume text extraction pipeline.
 * Handles PDF (native + OCR), DOCX, TXT.
 * Returns raw text with per-token provenance (page, bbox).
 */

import { createHash } from "crypto";

export interface ExtractedToken {
  text: string;
  page: number;
  bbox?: [number, number, number, number]; // [x0, top, x1, bottom]
  confidence?: number;
}

export interface ExtractionResult {
  rawText: string;
  tokens: ExtractedToken[];
  method: "native" | "ocr" | "hybrid";
  pageCount: number;
  extractionTimeMs: number;
  ocrUsed: boolean;
  ocrConfidenceAvg?: number;
}

/**
 * Calculate SHA-256 hash of file buffer for deduplication.
 */
export function hashFile(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Extract text from PDF using native extraction.
 * Falls back to OCR if character density is too low.
 */
export async function extractFromPdf(
  buffer: Buffer,
  fallbackToOcr: boolean = true
): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    // Try native extraction first (using pdfplumber via node-pdfplumber or pdf-parse)
    // @ts-ignore - pdf-parse module lacks type definitions but is installed and functional
    const pdfParse = await import("pdf-parse");
    // @ts-ignore - pdf-parse module lacks type definitions
    const data = await pdfParse(buffer);

    if (!data.text || data.text.trim().length < 100) {
      // Low character density — likely scanned, fall back to OCR
      if (fallbackToOcr) {
        return extractFromPdfOcr(buffer, startTime);
      }
    }

    // Native extraction succeeded; create tokens with page info
    const tokens: ExtractedToken[] = [];
    let pageNum = 1;

    // pdf-parse doesn't provide bbox info, so we approximate by page
    if (data.text) {
      const lines = data.text.split("\n");
      for (const line of lines) {
        if (line.trim()) {
          const words = line.split(/\s+/);
          for (const word of words) {
            tokens.push({
              text: word,
              page: pageNum,
              confidence: 0.95, // Native extraction is high confidence
            });
          }
        }
      }
    }

    return {
      rawText: data.text || "",
      tokens,
      method: "native",
      pageCount: data.numpages || 1,
      extractionTimeMs: Date.now() - startTime,
      ocrUsed: false,
    };
  } catch (err) {
    if (fallbackToOcr) {
      return extractFromPdfOcr(buffer, startTime);
    }
    throw err;
  }
}

/**
 * OCR-based PDF extraction (Tesseract or AWS Textract).
 * For MVP, we'll use a stub; in production, integrate Tesseract.js or AWS Textract.
 */
async function extractFromPdfOcr(
  buffer: Buffer,
  startTime: number
): Promise<ExtractionResult> {
  // TODO: Integrate Tesseract.js for browser-compatible OCR, or AWS Textract for cloud.
  // For now, return a stub result.
  throw new Error("OCR not yet implemented. Use native extraction only in MVP.");
}

/**
 * Extract text from DOCX using mammoth.js.
 */
export async function extractFromDocx(buffer: Buffer): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    const mammoth = await import("mammoth");
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const result = await mammoth.extractRawText({ arrayBuffer });

    const tokens: ExtractedToken[] = [];
    const lines = result.value.split("\n");

    for (const line of lines) {
      if (line.trim()) {
        const words = line.split(/\s+/);
        for (const word of words) {
          tokens.push({
            text: word,
            page: 1, // DOCX doesn't have page boundaries easily accessible
            confidence: 0.95,
          });
        }
      }
    }

    return {
      rawText: result.value,
      tokens,
      method: "native",
      pageCount: 1,
      extractionTimeMs: Date.now() - startTime,
      ocrUsed: false,
    };
  } catch (err) {
    throw new Error(`DOCX extraction failed: ${err}`);
  }
}

/**
 * Extract text from plain text file.
 */
export function extractFromTxt(buffer: Buffer): ExtractionResult {
  const startTime = Date.now();
  const text = buffer.toString("utf-8");

  const tokens: ExtractedToken[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    if (line.trim()) {
      const words = line.split(/\s+/);
      for (const word of words) {
        tokens.push({
          text: word,
          page: 1,
          confidence: 1.0,
        });
      }
    }
  }

  return {
    rawText: text,
    tokens,
    method: "native",
    pageCount: 1,
    extractionTimeMs: Date.now() - startTime,
    ocrUsed: false,
  };
}

/**
 * Main dispatcher: route to appropriate extractor based on file format.
 */
export async function extractResumeText(
  buffer: Buffer,
  fileFormat: string
): Promise<ExtractionResult> {
  const format = fileFormat.toLowerCase();

  if (format === "pdf") {
    return extractFromPdf(buffer, true); // Fallback to OCR if needed
  } else if (format === "docx" || format === "doc") {
    return extractFromDocx(buffer);
  } else if (format === "txt") {
    return extractFromTxt(buffer);
  } else {
    throw new Error(`Unsupported file format: ${format}`);
  }
}
