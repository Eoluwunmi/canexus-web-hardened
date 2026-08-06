# Resume Parser: Milestone 3 (Review UI + Passport Sync)

## ✅ What's New in M3

### 1. **Review Queue Page** (`src/app/dashboard/admin/resume-review/page.tsx`)

Web interface for reviewers to browse resumes needing review:
- Paginated list with filters (needs_review, low_confidence, failed, completed)
- Confidence badges with color coding
- Quick status view (parsed date, confidence score)
- Click-to-review navigation

**Features**:
- Filter by confidence threshold (default: <85%)
- Pagination (20 per page)
- Sort by parsed date
- Quick stats on hover

### 2. **Review Detail Page** (`src/app/dashboard/admin/resume-review/[parseId]/page.tsx`)

Full review interface for editing and approving resumes:
- **Extracted fields display**: identity, experience, education, skills
- **Inline editing**: Click "Edit" to fix extracted values
- **Confidence badges**: Shows per-field confidence
- **Correction notes**: Add context when correcting fields
- **Corrections log**: View all corrections made
- **Approve button**: Sync to Skills Passport with one click

**Features**:
- Real-time field editing
- Save corrections to labeled dataset
- Approval workflow (no auto-approval)
- Automatic Skills Passport sync on approve

### 3. **Skills Passport Sync** (`src/app/api/resumes/[parseId]/approve/route.ts`)

When reviewer clicks "Approve":
1. Extracts skills from parsed resume
2. Creates `userSkills` records with `verification_level='EVIDENCE_LINKED'`
3. Normalizes skill names to canonical IDs
4. Links work experience as evidence
5. Updates audit logs
6. Marks parse as `COMPLETED`

**Sync Details**:
```
Resume extracted skills → Lookup skill ID → Create userSkill record
                        ↓
                     Evidence: "Extracted from resume: filename"
                        ↓
                     Verification Level: EVIDENCE_LINKED
                        ↓
                     Visibility: EMPLOYERS
```

### 4. **API Endpoints (M3)**

**GET `/api/resumes/review-queue`**
- Returns paginated list of resumes needing review
- Filters: `needs_review`, `low_confidence`, `failed`, `completed`
- Query params: `page`, `limit`, `confidence_threshold`, `filter`

**GET `/api/resumes/{parseId}`**
- Returns full parse result with extracted data + metadata
- Includes corrections made so far
- Returns storage key for PDF download

**POST `/api/resumes/{parseId}/corrections`**
- Save a single field correction
- Appends to `parse_corrections` table (labeled dataset)
- Accepts: `fieldPath`, `originalValue`, `correctedValue`, `notes`

**POST `/api/resumes/{parseId}/approve`**
- Approve resume and sync to Skills Passport
- Creates `userSkills` records from parsed skills
- Marks parse as `COMPLETED`
- Returns count of skills synced

---

## 🚀 Getting Started with M3

### 1. Ensure M1+M2 are running
```bash
npm run db:push  # Apply all migrations
npm run dev      # Dev server
npm run resume:parse-worker  # Worker (M2)
```

### 2. Upload a test resume
```bash
curl -X POST http://localhost:3000/api/resumes/upload \
  -F "file=@tests/golden-resumes/resume-001-simple.txt"
```

### 3. Wait for parsing
Worker will extract text → call Claude → store results

### 4. Access review queue
Navigate to: **Admin Dashboard** → **Resume Review** → Review Queue

Or directly: `http://localhost:3000/dashboard/admin/resume-review`

### 5. Click "Review" on a resume
- See extracted data
- Edit fields as needed
- Save corrections
- Click "Approve & Sync to Passport"

### 6. Verify Skills Passport
Check applicant's passport → new skills added from resume

---

## 📊 Review Workflow

```
┌─────────────────────────┐
│   Resume Uploaded       │
│   (M1: upload)          │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│   Text Extracted        │
│   (M1: extract text)    │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│   LLM Parsing Complete  │
│   (M2: Claude Sonnet)   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│   Status: NEEDS_REVIEW  │
│   (M3: Shows in queue)  │
└────────────┬────────────┘
             │ Reviewer clicks "Review"
             ▼
┌─────────────────────────┐
│   Detail Page Loads     │
│   (M3: Split-view UI)   │
└────────────┬────────────┘
             │ Reviewer edits + saves corrections
             ▼
┌─────────────────────────┐
│   Correction Saved      │
│   (M3: POST /approve)   │
└────────────┬────────────┘
             │ Reviewer clicks "Approve & Sync"
             ▼
┌─────────────────────────┐
│   Skills → Passport     │
│   (M3: Create userSkills)
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│   Status: COMPLETED     │
│   Redirect to queue     │
└─────────────────────────┘
```

---

## 🎯 Key M3 Features

### Field Editing
- Click "Edit" on any extracted field
- Inline input + optional notes
- Save or cancel
- Auto-records original + corrected values

### Confidence Indicators
- Per-field confidence badges (0-100%)
- Color coding: Green (>90%), Yellow (80-90%), Red (<80%)
- Helps reviewers prioritize fields to check

### Corrections Dataset
- Every correction is logged to `parse_corrections`
- Can be used to fine-tune LLM extraction
- Supports future model retraining

### Skills Passport Integration
- Approved skills automatically added to user's passport
- Verification level set to `EVIDENCE_LINKED`
- Evidence links back to resume
- Visible to employers

### Approval Workflow
- No auto-approval: always requires human review
- Clear "Approve & Sync" button
- Confirmation message on success
- Redirects to queue after approval

---

## 🗂️ API Reference (M3)

### Review Queue
```bash
# Get resumes needing review
curl http://localhost:3000/api/resumes/review-queue?filter=needs_review

# Response:
{
  "data": [
    {
      "parseId": "uuid",
      "resumeId": "uuid",
      "fileName": "resume.pdf",
      "status": "NEEDS_REVIEW",
      "overallConfidence": 0.87,
      "needsReview": true,
      "parsedAt": "2025-08-06T12:34:56Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 },
  "filter": "needs_review"
}
```

### Resume Details
```bash
# Get full parse result
curl http://localhost:3000/api/resumes/{parseId}

# Response:
{
  "parseId": "uuid",
  "resumeId": "uuid",
  "fileName": "resume.pdf",
  "status": "NEEDS_REVIEW",
  "extractedData": { ...full ParsedResume... },
  "overallConfidence": 0.87,
  "fieldConfidence": { "identity.full_name": 0.98, ... },
  "corrections": [
    {
      "fieldPath": "identity.full_name",
      "originalValue": "Sarh Martinez",
      "correctedValue": "Sarah Martinez",
      "notes": "Typo in OCR"
    }
  ]
}
```

### Save Correction
```bash
# POST correction
curl -X POST http://localhost:3000/api/resumes/{parseId}/corrections \
  -H "Content-Type: application/json" \
  -d '{
    "fieldPath": "identity.full_name",
    "originalValue": "Sarh Martinez",
    "correctedValue": "Sarah Martinez",
    "notes": "Typo"
  }'

# Response:
{
  "correctionId": "uuid",
  "fieldPath": "identity.full_name",
  "correctedAt": "2025-08-06T12:34:56Z"
}
```

### Approve & Sync
```bash
# POST approval
curl -X POST http://localhost:3000/api/resumes/{parseId}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "includeSkills": true,
    "includeExperience": true,
    "includeEducation": true
  }'

# Response:
{
  "parseId": "uuid",
  "status": "COMPLETED",
  "skillsCreated": 5,
  "experienceRecords": 2,
  "message": "Resume approved and synced to Skills Passport (5 skills added)"
}
```

---

## 🗄️ Database Changes (M3)

No new tables, but M3 uses:
- `parse_corrections` — stores all corrections (labeled dataset)
- `userSkills` — created when resume approved
- `users` — linked to applicant
- `auditLogs` — tracks all approvals

### Skill Sync Flow
```sql
-- When "Approve" is clicked:

1. Find skills in extracted_data.skills
2. FOR EACH skill:
   - Lookup skill ID by canonical_id
   - If not found, create new skill
   - Create userSkill record with verification_level='EVIDENCE_LINKED'
   - Set visibility='EMPLOYERS'
3. Update resumeParse status='COMPLETED'
4. Log audit: RESUME_APPROVED_AND_SYNCED
```

---

## 🎨 UI Components (M3)

### Page Structure
```
ReviewQueuePage
├── Header
├── Filters (needs_review, low_confidence, failed, completed)
├── Summary stats
└── Table
    └── [parseId, fileName, status, confidence, actions]
        └── Link to ReviewDetailPage

ReviewDetailPage
├── Header (fileName, confidence)
├── Alerts (needs_review warnings)
├── Main Grid
│   ├── Left: Extracted Data
│   │   ├── Identity fields
│   │   ├── Experience summary
│   │   └── Skills tags
│   └── Right: Actions
│       ├── Approve button
│       ├── Back button
│       ├── Corrections log
│       └── Metadata
└── FieldEditor (inline editing modal)
```

### Styling
- Tailwind CSS (existing CANexus theme)
- Color coding: Green (90%+), Yellow (80-90%), Red (<80%)
- Responsive: Mobile-friendly
- Accessibility: Keyboard navigation + labels

---

## 🔄 Corrections Dataset

Every correction creates a labeled training example:
```
{
  "fieldPath": "identity.full_name",
  "originalValue": "Sarh Martinez",  // What Claude extracted
  "correctedValue": "Sarah Martinez", // What human corrected to
  "notes": "Typo - OCR misread 'r' as missing"
}
```

Use this to:
1. **Evaluate**: Measure Claude accuracy over time
2. **Retrain**: Fine-tune prompts based on common corrections
3. **Debug**: Identify which fields need LLM improvement

---

## 🧪 Testing M3

### Manual Test
1. Upload resume → wait for parsing
2. Go to `/dashboard/admin/resume-review`
3. Click a resume
4. Edit a field
5. Click "Approve & Sync"
6. Check applicant's passport → skills added ✅

### Verify Skills Synced
```sql
SELECT u.name, us.verification_level, s.name as skill
FROM user_skills us
JOIN skills s ON us.skill_id = s.id
JOIN users u ON us.user_id = u.id
WHERE u.role = 'APPLICANT'
ORDER BY us.created_at DESC;
```

---

## ⚠️ Known Limitations (M3)

1. **No PDF viewer yet** — Can't see source document in review UI
2. **No field highlighting** — Can't click skill → highlight in PDF
3. **No bulk approval** — One resume at a time
4. **No redaction mode** — Shows full PII to reviewers
5. **No AI suggestions** — Reviewer must manually correct
6. **No change tracking** — Can't see who corrected what field

---

## 🚀 Next: Milestone 4+ (Future)

### M4: Matching & Explanations
- Parse job descriptions
- Score candidates per role
- Show which skills matched/missing

### M5: Compliance
- Redaction mode (hide PII)
- Retention TTL + erasure
- Adverse-impact reporting
- Audit logs export

### M6: Scale & Optimization
- Bulk import UI
- Async email notifications
- PDF viewer integration
- Admin dashboard + analytics

---

## Summary: M1 → M2 → M3

| Feature | M1 | M2 | M3 |
|---------|----|----|-----|
| Upload | ✅ | ✅ | ✅ |
| Text extraction | ✅ | ✅ | ✅ |
| LLM extraction | ❌ | ✅ | ✅ |
| Confidence scoring | ❌ | ✅ | ✅ |
| Review UI | ❌ | ❌ | ✅ |
| Inline editing | ❌ | ❌ | ✅ |
| Corrections logging | ✅ Schema | ✅ | ✅ Used |
| Skills Passport sync | ❌ | ❌ | ✅ |
| Approval workflow | ❌ | ❌ | ✅ |

**Status**: ✅ Milestone 3 complete. Resume parsing pipeline fully integrated with Skills Passport.

---

## 📞 Debugging M3

### Approval fails with "Applicant user not found"
- Resume uploaded by non-existent user ID
- Check: `resumes.uploaded_by_user_id` exists in `users` table

### Skills not appearing in passport after approval
- Check `userSkills` table for new records
- Verify `verification_level = 'EVIDENCE_LINKED'`
- Confirm `visibility = 'EMPLOYERS'`

### Review page shows "No resumes"
- Check worker is running: `npm run resume:parse-worker`
- Verify resume status: should be `NEEDS_REVIEW` or `COMPLETED`
- Query: `SELECT status, COUNT(*) FROM resumeParses GROUP BY status`

---

**M3 Complete!** Your resume parser now has a full review interface and integrates with Skills Passport.
