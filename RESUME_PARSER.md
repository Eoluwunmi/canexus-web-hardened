# CANexus Smart Resume Parser

## Overview
Milestone 1 (completed): Skeleton + evaluation harness + text extraction

The Smart Resume Parser is a service that ingests candidate resumes, extracts structured data, and ranks candidates against roles. Built incrementally with human review at every stage.

**Status**: MVP-ready for text extraction. LLM extraction (Milestone 2) not yet implemented.

## Architecture

```
┌─────────────────┐
│  Upload (API)   │  POST /api/resumes/upload
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   S3 Storage    │  Original file, immutable
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐
│  resumeParses (PENDING)  │  Queue pending extractions
└────────┬─────────────────┘
         │
         ▼ (Worker poll)
┌──────────────────────────┐
│   Text Extraction        │  PDF→DOCX→TXT via pdf-parse, mammoth
├──────────────────────────┤  Returns: raw text + tokens + provenance
│  Extract → Validate      │
└────────┬─────────────────┘
         │
         ▼ (Milestone 2+)
┌──────────────────────────┐
│   LLM Extraction         │  Claude API: structured field extraction
├──────────────────────────┤  Inputs: raw text, confidence scoring
│  Parse → Normalize       │  
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  Review UI (Milestone 3) │  Human corrections → labeled data
│  Corrections Loop        │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│   Skills Passport        │  Auto-populate with reviewer approval
│   Sync (Integration)     │
└──────────────────────────┘
```

## Files

### Schema & Database
- `src/db/schema.ts` — New tables: `resumes`, `resumeParses`, `parseCorrections`, `parseCosts`
- `drizzle/0007_resume_parser.sql` — Migration (status: pending `npm run db:push`)

### Core Logic
- `src/lib/resume-extraction.ts` — Text extraction (PDF native, DOCX, TXT)
- `src/lib/resume-eval.ts` — Evaluation harness with golden set metrics

### APIs & Workers
- `src/app/api/resumes/upload/route.ts` — File upload endpoint (dedup + S3 + queue)
- `scripts/resume-parse-worker.ts` — Worker that polls queue + extracts (status: stub for LLM)

### Test Data
- `tests/golden-resumes/` — Golden resume set (2 samples: simple, bilingual)

### CLI Scripts
- `scripts/resume-eval.ts` — Run evaluation, output JSON report + baseline comparison
- `npm run resume:eval` — Execute evaluation
- `npm run resume:parse-worker` — Run worker indefinitely

## Setup & Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Run database migration
```bash
npm run db:push  # Applies drizzle/0007_resume_parser.sql
```

### 3. Test text extraction
```bash
npm run resume:eval
```
Expected output:
```
═══════════════════════════════════════════
  RESUME PARSER EVALUATION REPORT
═══════════════════════════════════════════

📊 Summary:
  Total Resumes: 2
  Passed (F1 ≥ 0.9): 1
  Failed (F1 < 0.9): 1
  Overall Accuracy: 75.00%
  ...
```

### 4. Test upload API (local dev server)
```bash
npm run dev

# In another terminal:
curl -X POST http://localhost:3000/api/resumes/upload \
  -F "file=@tests/golden-resumes/resume-001-simple.txt"

# Expected response:
{
  "parseId": "...",
  "resumeId": "...",
  "status": "PENDING",
  "message": "Resume uploaded and queued for parsing"
}
```

### 5. Run worker (processes pending parses)
```bash
npm run resume:parse-worker
# Worker polls every 5s, processes PENDING → EXTRACTED → NEEDS_REVIEW
```

## Current Capabilities (Milestone 1)

✅ File upload with deduplication (SHA-256)
✅ S3 storage (immutable original)
✅ Text extraction (PDF native, DOCX, TXT)
✅ Provenance tracking (page, token positions)
✅ Evaluation harness with golden set
✅ Cost tracking infrastructure (db schema)
✅ Audit logging on all parse operations

❌ LLM extraction (queued for Milestone 2)
❌ Structured field extraction
❌ Confidence scoring
❌ Review UI
❌ Skills Passport sync
❌ Matching/ranking against JDs

## Integration with CANexus Skills Passport

In Milestone 2 (LLM extraction), parsed skills will:
1. Extracted skill names → canonical skill IDs via `skills` table
2. Create `userSkills` records with `verification_level = 'SELF_REPORTED'`
3. Link work experience bullets as evidence
4. Reviewer approves in review UI → `verification_level = 'EVIDENCE_LINKED'`

Flow:
```
Resume uploaded
   ↓
Text extracted
   ↓
LLM parses: { skills: ["Python", "React", ...], experience: [...] }
   ↓
Reviewer corrects fields in UI
   ↓
On approve: INSERT userSkills + evidence_files
   ↓
Skills now available for matching
```

## Evaluation & Quality Assurance

### Running the Evaluation
```bash
npm run resume:eval
```

The evaluation harness:
- Loads golden resume set from `tests/golden-resumes/*.json`
- Extracts text from each resume
- Compares extracted fields vs. expected values
- Outputs precision/recall/F1 per field
- Writes full report to `eval-report.json`
- Exits with status 0 (pass) or 1 (fail) based on overall accuracy ≥ 90%

### Adding Golden Resumes
1. Create `tests/golden-resumes/resume-NNN-description.json`:
   ```json
   {
     "name": "resume-NNN-description",
     "description": "Scenario description",
     "filePath": "resume-NNN-description.txt",
     "expectedFields": {
       "identity.full_name": "...",
       "experience[0].employer": "...",
       ...
     }
   }
   ```

2. Add the actual resume file `resume-NNN-description.txt` in the same directory

3. Rerun `npm run resume:eval` — the new resume is automatically included

### Regression Testing (CI)
In `.github/workflows/`, add:
```yaml
- name: Evaluation
  run: npm run resume:eval
```

The evaluation will fail the build if accuracy drops below 90%.

## Next Steps (Milestones 2–6)

### Milestone 2: LLM Extraction
- Implement `parseResume()` function using Claude Sonnet
- Structured output: `{ identity, experience, education, skills, ... }`
- Confidence scoring per field
- Validation + normalization (dates, titles, skills)

### Milestone 3: Review UI
- Split-view: original document + extracted fields
- Inline editing, field-level provenance highlighting
- Bulk queue with filters (needs_review, low_confidence, parse_failed)
- Corrections logged to `parse_corrections` table

### Milestone 4: Matching & Explanations
- Parse job descriptions
- Score candidates per role
- Explainability: which skills matched, which are missing

### Milestone 5: Compliance Hardening
- Redaction mode (hide name, location, graduation year)
- Retention TTL + hard delete (PIPEDA)
- Adverse-impact reporting
- Audit log (read, export, edit)

### Milestone 6: Integration & Deploy
- ATS connector (Greenhouse/Lever interface)
- Webhooks: parse.completed, parse.failed, review.required
- IaC for Vercel/AWS
- Load testing

## Known Limitations

1. **No OCR yet** — Falls back to native extraction; scanned PDFs will fail
2. **No LLM extraction** — Structured fields are stubs
3. **No confidence scoring** — All fields marked needs_review=true
4. **No deduplication on identity** — Only SHA-256 file hash, not fuzzy name match
5. **Simple normalization** — Dates/titles/skills not yet mapped to canonical forms
6. **Worker is polling** — Not production-grade (should use message queue)

## Cost Estimates (Per Resume)

| Component | Cost | Notes |
|-----------|------|-------|
| PDF/DOCX parsing (native) | $0 | free |
| OCR (if needed) | $0.50 | AWS Textract approximate |
| LLM extraction (Claude) | $0.10 | ~500 input + 100 output tokens @ $1-3/MTok |
| S3 storage | $0.0003 | per resume/month |
| **Total** | **~$0.60** | one-time per resume |

For 100 resumes/month: ~$60/month

## Security & Privacy

- Original files stored immutably in S3 with encryption at rest
- Parse results contain PII; stored in Postgres (encrypted per CANexus security model)
- Audit trail on all reads/edits (append-only auditLogs table)
- Soft-delete support (users.status = DELETED)
- Right-to-erasure: deletion cascades resumes → parses → corrections → costs
- No candidate PII in LLM provider training (Claude API zero-retention option)

## Support & Troubleshooting

**Problem: "File too large" error**
- Max file size is 20 MB. If resume is larger, it's likely a scanned PDF with high resolution.
- Solution: Re-export at 150 DPI instead of 300 DPI.

**Problem: "Unsupported file format" error**
- Supported: PDF, DOCX, DOC, TXT. HEIC, PNG, JPEG support added in Milestone 2 (OCR).
- Solution: Convert to PDF or DOCX first.

**Problem: Text extraction fails silently**
- Check worker logs: `npm run resume:parse-worker` should show errors.
- Likely cause: encrypted PDF or password-protected DOCX.
- Solution: Remove password protection before uploading.

## References

- Text extraction: [pdf-parse](https://npmjs.com/package/pdf-parse), [mammoth](https://npmjs.com/package/mammoth)
- LLM integration: [Anthropic SDK](https://sdk.anthropic.com/)
- Schema: `src/db/schema.ts` (resumes, resumeParses, parseCorrections, parseCosts tables)
- Evaluation: `src/lib/resume-eval.ts` (F1-based metrics)
