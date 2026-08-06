# Smart Resume Parser: Architectural Decisions

## Overview
This document records key technical decisions made during Milestone 1 (skeleton + text extraction) to enable reproducibility and informed future changes.

---

## Decision 1: Async Processing Architecture
**Choice**: Simple polling worker instead of message queue (SQS/RabbitMQ)

**Rationale**:
- Volume: ~100 resumes/month, <10 peak/hour doesn't justify infrastructure complexity
- Deployment: Vercel Functions + Postgres is simpler than adding Redis/SQS
- MVP first: Can migrate to Bull/BullMQ or Temporal later without API changes

**Implementation**:
- Resume parse status machine: `PENDING → EXTRACTING → EXTRACTED → PARSING → COMPLETED | FAILED | NEEDS_REVIEW`
- Worker polls `resumeParses` WHERE status='PENDING' every 5s
- Each parse is idempotent (keyed on resume file hash)

**Trade-off**: Polling adds ~5s latency vs. event-driven, but simple and debuggable

**Future**: Swap out `scripts/resume-parse-worker.ts` for a proper job queue without changing the API

---

## Decision 2: Text Extraction Library Choice
**Choice**: `pdf-parse` (Node.js) + `mammoth` (DOCX) instead of Python-based approach

**Rationale**:
- Monorepo: CANexus is Node.js + Next.js; keep single language
- Deployment: No separate Python service to manage
- Performance: Native module performance acceptable for MVP volume
- Simplicity: Easier to debug in same codebase

**Limitations**:
- `pdf-parse` provides page count but no bounding boxes (added stub for future OCR)
- OCR (Tesseract.js or AWS Textract) deferred to Milestone 2
- Scanned PDFs will fail; users get actionable error message

**Future**: If OCR becomes critical, can swap in Tesseract.js (browser + Node compatible) or AWS Textract (cloud)

---

## Decision 3: File Deduplication Strategy
**Choice**: SHA-256 hash only; defer fuzzy identity matching to Milestone 5

**Rationale**:
- 95% of duplicates are exact-file re-uploads (same PDF)
- Hash collision is impossible; easy to test
- Fuzzy matching (name+email+phone similarity) is harder to tune
- Small MVP volume; exact matching sufficient for now

**Implementation**:
- `resumes.fileHash` (VARCHAR 64) stores SHA-256
- On upload: check for existing resume with same hash
- If found, return existing parseId (don't re-upload)

**Future**: Add fuzzy deduplication in Milestone 2 if duplicate applications detected

---

## Decision 4: Provenance Storage Model
**Choice**: Store token-level provenance (page, bbox) in JSONB; no separate table

**Rationale**:
- Query simplicity: One JSON blob per parse result, easier to sync in review UI
- Flexibility: Can evolve schema without migration
- Performance: JSONB indexing available if needed

**Schema**:
```jsonb
"provenance": [
  { "field_path": "identity.full_name", "page": 1, "bbox": [50, 100, 200, 120], "text_span": "Sarah Martinez" },
  { "field_path": "identity.emails[0]", "page": 1, "bbox": [50, 130, 300, 145], "text_span": "sarah@example.com" }
]
```

**Trade-off**: JSONB is slower to query than relational, but UI only needs the one parse result; acceptable

---

## Decision 5: Cost Tracking Separation
**Choice**: Separate `parseCosts` table (1:1 with parse) instead of inline costs

**Rationale**:
- Billing/analytics queries often exclude cost columns
- Keeps parse data tight for common queries
- Clean separation of concerns: parsing vs. cost accounting
- GDPR erasure: costs don't need to be deleted with personal data

**Implementation**:
```sql
INSERT INTO parse_costs (parse_id, llm_cost_usd, ocr_cost_usd, total_cost_usd)
SELECT parse_id, 0.1, 0.0, 0.1 FROM resume_parses WHERE status='COMPLETED'
```

**Future**: Rollup into monthly cost reports for billing

---

## Decision 6: Confidence Scoring Threshold
**Choice**: Field needs_review=true if any single field <85% confidence OR overall <70%

**Rationale**:
- Conservative: ensure human review catches low-quality extracts
- Avoids skewing passport with poor-quality skills
- Can tune thresholds per field type in Milestone 2

**Future**: Lower thresholds as LLM accuracy improves

---

## Decision 7: Resume Format Support (MVP)
**Choice**: PDF, DOCX, TXT only; skip HEIC, PNG, RTF, HTML for now

**Rationale**:
- 95% of resumes are PDF or DOCX
- Images (HEIC, PNG) require OCR (deferred to Milestone 2)
- HTML is rare and brittle to parse
- RTF is legacy; modern tools export PDF instead
- Scope creep risk: stick to high-impact formats

**Implementation**:
- File extension validation on upload
- Clear error message: "Unsupported format. Please upload PDF, DOCX, or TXT"

**Future**: Add image + OCR support when demand justifies

---

## Decision 8: Integration with Skills Passport
**Choice**: Direct INSERT to `userSkills` + `evidenceFiles` after review approval, not via LLM

**Rationale**:
- LLM extraction is separate from Skills Passport
- Human review is the trust boundary; approve before linking
- Cleaner: parser outputs structured data; reviewer explicitly confirms
- Reversible: corrections don't auto-update passport (explicit action)

**Flow**:
1. Parse resume → extract skills
2. Review UI shows extracted skills + provenance
3. Reviewer corrects/approves
4. On click "Confirm to Passport": INSERT userSkills + audit log
5. Skills now appear in passport

**Future**: Add bulk approval mode (approve + sync 100 at once)

---

## Decision 9: Audit Trail for Parse Corrections
**Choice**: Append-only `parseCorrections` table, not inline field versioning

**Rationale**:
- ML training: corrections become labeled data for future model tuning
- Audit: can see exact what reviewer changed and when
- Privacy: corrections row can be deleted without affecting parse result

**Schema**:
```sql
INSERT INTO parse_corrections (parse_id, corrected_by_user_id, field_path, original_value, corrected_value, notes)
VALUES (?, ?, 'identity.full_name', 'Sarh Martinez', 'Sarah Martinez', 'Typo in OCR')
```

**Future**: Use corrections table to build labeled dataset for model retraining

---

## Decision 10: Redaction vs. Privacy (Placeholder)
**Choice**: Defer redaction mode to Milestone 5; currently no PII scrubbing

**Rationale**:
- MVP users (applicants uploading own resume) don't need redaction
- Employers viewing candidate resumes need full data (name, email, etc.)
- Redaction for bias-aware screening is valuable but not MVP-critical

**Future** (Milestone 5):
- Add `redaction_mode` toggle in review UI
- Strip: name, addresses, institution names, graduation years, photos
- Only affects reviewer view; stored data unchanged

---

## Trade-Offs & Risks

| Decision | Risk | Mitigation |
|----------|------|------------|
| Polling worker | 5s latency; thundering herd at scale | Easy swap to Bull/SQS; add backpressure |
| Node.js text extraction | PDF bbox metadata lost | Accept for MVP; add Tesseract.js in M2 |
| Hash-only dedup | Misses fuzzy duplicates | Acceptable for <100/month; add in M5 |
| Inline provenance JSON | Slow JSONB queries | Small dataset; optimize if needed |
| No redaction yet | Bias risk if not used carefully | Mitigation: audit trail, export restrictions |

---

## Dependency Versions (Milestone 1)

```json
{
  "pdf-parse": "^1.1.1",     // PDF text extraction
  "mammoth": "^1.6.0",       // DOCX conversion to HTML
  "bull": "^4.12.3",         // Job queue (future milestone)
  "redis": "^4.6.11"         // Job queue backend (future milestone)
}
```

Rationale:
- `pdf-parse`: Popular, stable, 50M+ downloads
- `mammoth`: Dedicated DOCX handler, better than generic `docx` lib
- `bull`: When we move to queue, it's Drizzle-compatible with Postgres
- `redis`: Bull works with Postgres or Redis; Postgres for simplicity

---

## Testing Strategy (Milestone 1)

1. **Unit tests** (not yet written): Test `parseExtractedFields()` stub
2. **Integration tests** (not yet written): Upload → extract → verify fields
3. **Golden set evaluation** (implemented): `npm run resume:eval` compares field-level accuracy
4. **CI gating** (future): Build fails if `npm run resume:eval` accuracy < 90%

---

## Rollback & Rollout Plan

**If errors detected before Milestone 2**:
1. Disable upload endpoint: return "Maintenance" error
2. Mark parse status as FAILED
3. Notify user via email (add email service in M2)
4. Plan fix + re-run evaluation before re-enabling

**Gradual rollout** (future):
- Beta: 10 applicants (test upload flow)
- Wider beta: 100 applicants (measure extraction quality)
- GA: Full rollout with review UI (Milestone 3)
- Employer invite: After review UI stable (Milestone 3+)

---

## What This Decision Doc Enables

1. **Clarity**: Why we chose pdf-parse over PyMuPDF, polling over SQS, etc.
2. **Reproducibility**: New team member can understand architectural intent
3. **Informed iteration**: When swapping pdf-parse for Tesseract, the trade-off is documented
4. **Audit trail**: If there's a bug, we can trace back to the decision that led to it
5. **Future generations**: Why certain code exists and what it's trying to solve

---

## Changes to This Document

Only when a major architectural decision is made. Minor bug fixes don't warrant an update.

Date | Change | Reason
-----|--------|-------
2025-08-06 | Initial (M1) | Skeleton + text extraction decision points
