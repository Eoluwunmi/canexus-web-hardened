# Resume Parser: Quick Start (5 minutes)

## ✅ What's Already Done (Milestone 1)

- [x] Database schema (resumes, resumeParses, parseCorrections, parseCosts tables)
- [x] Text extraction pipeline (PDF → DOCX → TXT)
- [x] File upload API (`POST /api/resumes/upload`)
- [x] Parse worker (async processing, polls every 5s)
- [x] Evaluation harness (golden set, F1 metrics)
- [x] Cost tracking infrastructure
- [x] Audit logging on all operations
- [x] Documentation (RESUME_PARSER.md, RESUME_PARSER_DECISIONS.md)

## 🚀 Get It Running (Now)

### 1. Install dependencies
```bash
npm install
# Adds: pdf-parse, mammoth, bull, redis
```

### 2. Apply database migration
```bash
npm run db:push
# Creates tables: resumes, resumeParses, parseCorrections, parseCosts
```

### 3. Run evaluation (verify text extraction works)
```bash
npm run resume:eval
```

**Expected output:**
```
═══════════════════════════════════════════
  RESUME PARSER EVALUATION REPORT
═══════════════════════════════════════════

📊 Summary:
  Total Resumes: 2
  Passed (F1 ≥ 0.9): 1
  Failed (F1 < 0.9): 1
  Overall Accuracy: 75.00%

✅ Full report saved to: eval-report.json
```

### 4. Start dev server + worker in two terminals

**Terminal 1: Dev server**
```bash
npm run dev
# Runs on http://localhost:3000
```

**Terminal 2: Parse worker**
```bash
npm run resume:parse-worker
# Polls every 5s for PENDING parses
# Output:
#   Processing parse job: <uuid>
#   Extracting text from resume.pdf...
#   ✅ Parse completed: <uuid>
```

### 5. Test upload via curl
```bash
curl -X POST http://localhost:3000/api/resumes/upload \
  -F "file=@tests/golden-resumes/resume-001-simple.txt" \
  -H "Authorization: Bearer <your-session-token>"

# Or use Postman: POST /api/resumes/upload, Body: form-data, Key: file
```

**Expected response:**
```json
{
  "parseId": "550e8400-e29b-41d4-a716-446655440000",
  "resumeId": "550e8400-e29b-41d4-a716-446655440001",
  "status": "PENDING",
  "uploadedAt": "2025-08-06T12:34:56.000Z",
  "message": "Resume uploaded and queued for parsing"
}
```

**Then check worker logs** → resume is extracted and moved to NEEDS_REVIEW status

---

## 📋 What's NOT Done Yet (Milestone 2+)

- LLM extraction (structured field parsing via Claude)
- Confidence scoring
- Skill normalization (to canonical IDs)
- Review UI (split-view, inline editing, highlighting)
- Skills Passport integration
- Matching/ranking against job descriptions
- OCR support (scanned PDFs)
- Bulk import + admin tools
- Email notifications
- Compliance features (redaction, retention, adverse-impact reporting)

---

## 📁 File Layout

```
canexus-web/
├── src/
│   ├── db/
│   │   └── schema.ts                      ← New tables: resumes, resumeParses, etc.
│   ├── lib/
│   │   ├── resume-extraction.ts           ← Text extraction (PDF, DOCX, TXT)
│   │   └── resume-eval.ts                 ← Evaluation harness
│   └── app/api/
│       └── resumes/
│           └── upload/route.ts            ← Upload endpoint
├── scripts/
│   ├── resume-eval.ts                     ← CLI: run evaluation
│   └── resume-parse-worker.ts             ← Worker: process parse jobs
├── tests/
│   └── golden-resumes/
│       ├── resume-001-simple.json         ← Metadata
│       ├── resume-001-simple.txt          ← Test file
│       ├── resume-002-bilingual.json
│       └── resume-002-bilingual.txt
├── drizzle/
│   └── 0007_resume_parser.sql             ← Migration
├── RESUME_PARSER.md                       ← Full documentation
├── RESUME_PARSER_DECISIONS.md             ← Architectural decisions
└── RESUME_PARSER_QUICKSTART.md            ← This file
```

---

## 🧪 Add More Test Resumes

1. Create metadata file: `tests/golden-resumes/resume-NNN-description.json`
   ```json
   {
     "name": "resume-NNN-description",
     "description": "What makes this resume interesting (multi-column, scanned, gaps, etc.)",
     "filePath": "resume-NNN-description.txt",
     "expectedFields": {
       "identity.full_name": "Jane Doe",
       "identity.emails[0]": "jane@example.com",
       "experience[0].employer": "Tech Corp",
       "education[0].institution": "University"
     }
   }
   ```

2. Create resume file: `tests/golden-resumes/resume-NNN-description.txt`
   (or .pdf, .docx)

3. Re-run evaluation:
   ```bash
   npm run resume:eval
   ```
   The new resume is automatically picked up and tested.

---

## 🐛 Debugging Tips

**Problem: "Parse status stuck on PENDING"**
- Check worker is running: `npm run resume-parse-worker`
- Check Postgres connection string in `.env`
- Check disk space for S3 upload

**Problem: Text extraction fails (error in worker logs)**
- Likely: encrypted PDF or password-protected DOCX
- Solution: unprotect file, re-upload
- Check error_message in resumeParses table

**Problem: "File too large" error**
- Max 20 MB. If resume > 20 MB, it's probably a high-res scan.
- Solution: re-export PDF at 150 DPI instead of 300 DPI

**Problem: Evaluation reports 0% accuracy**
- Check `parseExtractedFields()` stub in `src/lib/resume-eval.ts`
- It's intentionally minimal (only extracts email, phone, name)
- This is expected for M1; real LLM extraction comes in M2

---

## 📊 Database Queries (Manual Inspection)

```sql
-- See all uploads
SELECT id, uploaded_by_user_id, file_name, created_at FROM resumes;

-- See parse statuses
SELECT r.file_name, p.status, p.overall_confidence, p.needs_review
FROM resume_parses p
JOIN resumes r ON p.resume_id = r.id;

-- See parse errors
SELECT r.file_name, p.error_message
FROM resume_parses p
JOIN resumes r ON p.resume_id = r.id
WHERE p.status = 'FAILED';

-- See cost breakdown
SELECT SUM(llm_cost_usd) as total_llm, SUM(ocr_cost_usd) as total_ocr, SUM(total_cost_usd) as total
FROM parse_costs;

-- See corrections (labeled data)
SELECT pc.field_path, pc.original_value, pc.corrected_value, COUNT(*) as corrections_count
FROM parse_corrections pc
GROUP BY field_path, original_value, corrected_value;
```

---

## 🔄 Next Steps (Milestone 2)

1. Implement `parseResume()` function using Claude Sonnet
   - Input: raw text from extraction + job description (optional)
   - Output: structured JSON matching the spec schema
   - Add confidence per field

2. Update worker to call LLM instead of stub
   - Stream tokens for long resumes
   - Cache tokens (same resume = same extraction)

3. Add field normalization
   - Dates: YYYY-MM
   - Titles: O*NET or ESCO taxonomy
   - Skills: canonical IDs from CANexus skills graph

4. Improve evaluation harness
   - Field-level confidence thresholds
   - Regression testing (compare vs. baseline)
   - Track cost-per-resume over time

---

## 📞 Questions?

- Full docs: see `RESUME_PARSER.md`
- Architectural decisions: see `RESUME_PARSER_DECISIONS.md`
- Schema: see `src/db/schema.ts` (resumes, resumeParses tables)
- Worker: see `scripts/resume-parse-worker.ts` (status machine)

---

**Status**: ✅ Milestone 1 (skeleton + text extraction) complete  
**Next**: Milestone 2 (LLM extraction + field normalization)  
**Timeline**: 2–3 weeks for full MVP (M1–M3)
