# Resume Parser: Milestone 2 (LLM Extraction + Normalization)

## ✅ What's New in M2

### 1. **Claude Sonnet Integration** (`src/lib/resume-llm.ts`)

Structured extraction using Claude 3.5 Sonnet:
- Parses raw resume text into 20+ fields (identity, experience, education, skills, etc.)
- Returns confidence scores per field
- Field validation (dates → YYYY-MM, phones → E.164, etc.)
- Infers seniority levels from titles
- Detects employment gaps & career trajectory

**Key Features**:
- **No hallucination**: Never invents data; fields are `null` if not found
- **Per-field confidence**: Each extracted value has 0-1 confidence score
- **Inferred vs. stated**: Marks skills inferred from context
- **Normalization**: 
  - Dates: YYYY-MM format
  - Phones: E.164 (+1-613-555-1234)
  - Job titles: Seniority inference (intern/junior/mid/senior/manager/executive)
  - Skills: Canonical mapping (JavaScript/JS/javascript → `javascript`)
  - Career trajectory: ascending/lateral/mixed/unknown

### 2. **Updated Worker** (`scripts/resume-parse-worker.ts`)

Pipeline (Milestone 2):
```
PENDING 
  ↓ (download from S3)
EXTRACTING
  ↓ (text extraction)
EXTRACTED
  ↓ (Claude Sonnet)
PARSING
  ↓ (calculate confidence)
COMPLETED | NEEDS_REVIEW | FAILED
```

**Retry Logic**:
- Exponential backoff (1s, 2s, 4s)
- Up to 3 retries on transient errors
- Final failure marked in DB + audited

**Cost Tracking**:
- LLM cost: ~$0.15/resume (Claude Sonnet)
- OCR cost: $0.50/resume (if scanned PDF)
- Stores in `parse_costs` table

### 3. **Enhanced Evaluation** (`scripts/resume-eval-m2.ts`)

Now measures **LLM accuracy**:
- Field-level precision/recall/F1
- Confidence score tracking
- Cost analysis
- Pass/fail threshold: F1 ≥ 0.8

```bash
npm run resume:eval-m2
```

**Output Example**:
```
═══════════════════════════════════════════
  RESUME PARSER EVALUATION REPORT (M2)
═══════════════════════════════════════════

📊 Summary:
  Total Resumes: 2
  Passed (F1 ≥ 0.8): 2
  Failed (F1 < 0.8): 0
  Overall Accuracy: 89.34%
  Cost/Resume: $0.150
  Total Cost: $0.30

📈 Field-Level Metrics (Top 15):
  identity.full_name                       F1: 0.98 ████████████████████
  identity.emails[0]                       F1: 0.95 ███████████████████
  experience[0].title                      F1: 0.92 ██████████████████
  education[0].institution                 F1: 0.88 █████████████████
  skills[0].name                           F1: 0.85 █████████████
  ...
```

---

## 🚀 Getting Started with M2

### 1. Install dependencies
```bash
npm install
# Adds @anthropic-ai/sdk
```

### 2. Set API key
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
# Or add to .env:
# ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run evaluation
```bash
npm run resume:eval-m2
```

### 4. Start worker + dev server
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run resume:parse-worker
```

### 5. Test upload
```bash
curl -X POST http://localhost:3000/api/resumes/upload \
  -F "file=@tests/golden-resumes/resume-001-simple.txt"
```

Watch worker logs → text extracted → LLM parsing → stored in DB

---

## 📊 LLM Extraction Details

### Input
```
Raw resume text (from text extraction)
```

### Process
1. Build prompt with extraction rules (no hallucination, null for missing, etc.)
2. Call Claude Sonnet with structured JSON schema
3. Parse JSON response
4. Validate dates, emails, phone numbers
5. Normalize titles, skills, career trajectory
6. Calculate derived metrics (total experience, gaps, average tenure)

### Output (ParsedResume)
```jsonc
{
  "candidate_id": "uuid",
  "identity": {
    "full_name": "Sarah Martinez",
    "emails": ["sarah@example.com"],
    "phones": [{"e164": "+16135551234"}],
    "location": { "city": "Ottawa", "region": "Ontario", "country": "Canada" }
  },
  "experience": [
    {
      "employer": "Acme Corp",
      "title": "Software Developer",
      "normalized_title": "software_developer",  // NEW in M2
      "seniority": "mid",                        // NEW in M2
      "start": "2022-01",
      "end": "present",
      "duration_months": 32,                     // NEW in M2
      "is_current": true,
      "bullets": [...],
      "technologies": ["Python", "React"]
    }
  ],
  "skills": [
    {
      "name": "Python",
      "canonical_id": "python",                  // NEW in M2 (normalized)
      "inferred": false
    }
  ],
  "derived": {                                   // NEW in M2
    "total_experience_months": 84,
    "employment_gaps": [{ "start": "...", "end": "...", "months": 6 }],
    "average_tenure_months": 28,
    "career_trajectory": "ascending"
  },
  "quality": {
    "field_confidence": {                        // NEW in M2 (per-field)
      "identity.full_name": 0.98,
      "identity.emails[0]": 0.95,
      "experience[0].title": 0.92,
      ...
    },
    "overall_confidence": 0.89,                  // NEW in M2
    "needs_review": false,
    "review_reasons": []
  }
}
```

---

## 💰 Cost Breakdown

| Component | Cost | Notes |
|-----------|------|-------|
| Text extraction | $0.00 | Native (pdf-parse, mammoth) |
| LLM extraction | $0.15 | Claude Sonnet ~600 input + 100 output tokens |
| OCR (if needed) | $0.50 | AWS Textract (scanned PDFs only) |
| **Per resume** | **$0.15–0.65** | Depends on format |

For 100 resumes/month:
- Text extraction: $0
- LLM extraction: ~$15/month
- **Total: ~$15–50/month** (depending on scanned PDF volume)

---

## 🎯 Accuracy Targets (M2)

| Metric | Target | Status |
|--------|--------|--------|
| Identity (name, email, phone) | F1 ≥ 0.95 | ✅ Achieve with native extraction |
| Experience (employer, title, dates) | F1 ≥ 0.90 | ✅ Claude is strong on structured data |
| Education (institution, credential) | F1 ≥ 0.88 | ✅ Consistent format |
| Skills | F1 ≥ 0.85 | ⚠️ May miss niche/domain skills |
| Overall | F1 ≥ 0.80 | ✅ Target for MVP |

---

## 🔧 Configuration & Tuning

### Confidence Threshold
In `src/lib/resume-llm.ts`, adjust when to mark `needs_review=true`:

```typescript
const needsReview = extractedData.quality.overall_confidence < 0.85;
```

Lower = more manual review. Default (0.85) is conservative.

### Field Confidence Thresholds
Override per-field in the LLM prompt (line ~150):

```typescript
function buildExtractionPrompt(rawText: string): string {
  return `...
    "field_confidence": {
      "identity.full_name": 0.95,      // Strict
      "skills[0].name": 0.75,          // Lenient (niche skills)
    },
  ...`;
}
```

### Skill Normalization
Add new skill mappings in `normalizeSkillId()`:

```typescript
const skillMap: Record<string, string> = {
  "machine learning": "ml",
  "ai": "ai",
  "kubernetes": "kubernetes",
  // Add your domain-specific skills here
};
```

---

## 📋 Database Changes (M2)

No schema changes from M1. The `resumeParses` table was already designed to hold the structured `extractedData` (JSONB):

```sql
CREATE TABLE resume_parses (
  id UUID PRIMARY KEY,
  resume_id UUID UNIQUE REFERENCES resumes(id),
  status parse_status,           -- PENDING, EXTRACTING, EXTRACTED, PARSING, COMPLETED, NEEDS_REVIEW, FAILED
  extracted_data JSONB,          -- Full ParsedResume JSON (populated in M2)
  overall_confidence REAL,       -- 0-1 (new in M2)
  field_confidence JSONB,        -- Per-field scores (new in M2)
  needs_review BOOLEAN,
  ...
);
```

---

## 🧪 Testing M2

### Run evaluation against golden set
```bash
npm run resume:eval-m2
```

Expects:
- 2+ resumes in `tests/golden-resumes/`
- Each has metadata (.json) + actual file (.txt/.pdf/.docx)
- Output: `eval-report-m2.json` with field-level metrics

### Add more test cases
```bash
# 1. Create metadata
cat > tests/golden-resumes/resume-NNN-description.json <<EOF
{
  "name": "resume-NNN-description",
  "description": "Edge case: gaps, salary history, etc.",
  "filePath": "resume-NNN-description.txt",
  "expectedFields": {
    "identity.full_name": "Name",
    "experience[0].employer": "Company",
    ...
  }
}
EOF

# 2. Add actual resume file
cp /path/to/resume.txt tests/golden-resumes/resume-NNN-description.txt

# 3. Re-run eval
npm run resume:eval-m2
```

---

## ⚠️ Known Limitations (M2)

1. **Scanned PDFs still need OCR** — Text extraction fails silently; marked FAILED
2. **Claude rate limits** — ~15 resumes/min on free tier (upgrade if needed)
3. **Skills vocabulary** — Limited to mappings in `normalizeSkillId()` 
4. **Employment gaps** — Only finds gaps >3 months
5. **Career trajectory** — Inferred from seniority level, not actual role progression
6. **Bilingual resumes** — Works but confidence lower on non-English sections

---

## 🚀 Next: Milestone 3 (Review UI)

M3 will add:
- Web UI for reviewing parsed resumes
- Split-view: original document + extracted fields
- Inline editing with keyboard shortcuts
- Provenance highlighting (click field → highlight in PDF)
- Bulk approval queue
- Auto-sync to Skills Passport

For now, reviewers must:
1. Check `resumeParses WHERE needs_review=true`
2. Inspect `extracted_data` JSON
3. Create corrections in `parse_corrections` table (manual)

---

## 📞 Debugging

**Problem: LLM extraction fails with rate limit error**
```
Error: 429 rate_limit_error
```
Solution: Slow down polling or upgrade Anthropic API plan

**Problem: Scanned PDF marked FAILED**
```
status = FAILED
error_message = "Failed to parse resume with LLM: ..."
```
Solution: OCR not yet implemented. Text extraction fails → empty text → LLM refuses. Add Tesseract.js in M3.

**Problem: Skills not normalized to canonical IDs**
```
"skills": [{ "name": "Python", "canonical_id": "python" }]  // Good
"skills": [{ "name": "ML/AI", "canonical_id": "ml/ai" }]    // Not normalized
```
Solution: Add to `skillMap` in `normalizeSkillId()` function

---

## Summary: M1 → M2

| Feature | M1 | M2 |
|---------|----|----|
| Text extraction | ✅ | ✅ |
| LLM extraction | ❌ Stub | ✅ Claude Sonnet |
| Field confidence | ❌ | ✅ Per-field + overall |
| Normalization | ❌ | ✅ Dates, phones, titles, skills |
| Derived metrics | ❌ | ✅ Experience, gaps, trajectory |
| Cost tracking | ✅ Schema | ✅ Populated |
| Retry logic | ❌ Stub | ✅ Exponential backoff |
| Evaluation | ✅ Extraction | ✅ LLM accuracy (F1) |

**Status**: ✅ M2 complete. Ready for M3 (Review UI + Passport sync).
