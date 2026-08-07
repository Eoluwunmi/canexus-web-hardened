# Skill Discovery Dashboard (M4): Quick Start

## ✅ What's New in M4

**Interactive Skill Discovery Dashboard** — A 4-step guided journey to help applicants discover and articulate their transferable skills:

1. **Career Assessment Quiz** — 5-8 questions about background and interests
2. **Experience Narrative** — User describes 2-3 key projects (with optional context)
3. **AI Extraction** — Claude Sonnet analyzes narrative and extracts relevant skills
4. **Confirmation & Gap Analysis** — User reviews/edits extracted skills, sees skill gaps vs. target role, and creates draft passport

---

## 🚀 Run M4 (5 minutes)

### 1. Apply Database Migrations
```bash
npm run db:push
```

### 2. Start Dev Server
```bash
npm run dev
```

### 3. Access the Discovery Hub
Navigate to: **http://localhost:3000/dashboard/applicant/discovery**

Or from the Applicant Dashboard, click **"Start Discovery →"** card.

---

## 📋 User Journey

### Step 1: Career Assessment Quiz
- Path: `/dashboard/applicant/discovery/quiz?sessionId=...`
- User answers 6 questions about experience, industry, interests, target role
- Responses stored in `discovery_sessions.quiz_responses` (JSONB)
- Can skip to next step or go back to edit

### Step 2: Experience Narrative
- Path: `/dashboard/applicant/discovery/narrative?sessionId=...`
- Large textarea: "Describe 2-3 key projects/roles"
- **Optional metadata checklist:**
  - Project type (web app, data analysis, etc.)
  - Timeline (how long?)
  - Team size (solo, small, large)
  - Industry/domain
  - Key technologies/tools
- Calls `/api/discovery/extract` → Claude Sonnet extracts skills
- Skills stored in `discovery_skills` table with confidence scores

### Step 3: AI Extraction Review
- Path: `/dashboard/applicant/discovery/review?sessionId=...`
- Shows extracted skills in editable table:
  - Skill name, proficiency level, confidence score, evidence snippet
  - User can edit/remove skills
  - Calls `/api/discovery/confirm` to sync to passport

### Step 4: Confirmation & Completion
- Path: `/dashboard/applicant/discovery/confirm?sessionId=...`
- Success message + next steps
- Links to:
  - Skills Passport (view newly added skills)
  - AI Coach (explore career matches)
  - Dashboard (go back)

---

## 🔌 API Endpoints (M4)

### Create/Update Discovery Session
```bash
POST /api/discovery/session
Content-Type: application/json

{
  "step": "quiz",
  "quizResponses": { "currentRole": "...", "yearsExp": 5, ... },
  "narrativeContent": "...",
  "narrativeMetadata": { "projectType": "...", ... },
  "targetOccupationId": "uuid"
}

# Response:
{
  "sessionId": "uuid",
  "status": "ACTIVE",
  "step": "progress"
}
```

### Fetch Discovery Session
```bash
GET /api/discovery/session

# Response:
{
  "sessionId": "uuid",
  "status": "ACTIVE",
  "quizResponses": {...},
  "narrativeContent": "...",
  "narrativeMetadata": {...},
  "targetOccupationId": "uuid",
  "createdAt": "2025-08-06T..."
}
```

### Extract Skills from Narrative (AI-powered)
```bash
POST /api/discovery/extract
Content-Type: application/json

{
  "sessionId": "uuid",
  "narrativeContent": "I built a Python web scraper...",
  "narrativeMetadata": { "projectType": "web app", "timeline": "6 months", ... }
}

# Response:
{
  "sessionId": "uuid",
  "skillsExtracted": 8,
  "overallConfidence": 0.87,
  "skills": [
    {
      "skillName": "Python",
      "proficiencyLevel": "ADVANCED",
      "confidence": 0.95,
      "evidenceSnippet": "I built a Python web scraper..."
    },
    ...
  ]
}
```

### Fetch Extracted Skills
```bash
GET /api/discovery/skills?sessionId=uuid

# Response:
{
  "sessionId": "uuid",
  "skills": [
    {
      "skillName": "Python",
      "proficiencyLevel": "ADVANCED",
      "confidence": 0.95,
      "evidenceSnippet": "..."
    },
    ...
  ]
}
```

### Confirm & Sync to Passport
```bash
POST /api/discovery/confirm
Content-Type: application/json

{
  "sessionId": "uuid",
  "skillIds": ["skill-id-1", "skill-id-2"]  // optional; if omitted, syncs all
}

# Response:
{
  "sessionId": "uuid",
  "status": "COMPLETED",
  "skillsCreated": 5,
  "skillsLinked": 8,
  "message": "5 new skills added to your passport (8 total linked)"
}
```

---

## 🗄️ Database Schema (M4)

### New Tables

**`discovery_sessions`** — Top-level session tracking
- `id` (UUID, PK)
- `user_id` (FK → users)
- `status` (ACTIVE | COMPLETED | ABANDONED)
- `target_occupation_id` (FK → occupations, optional)
- `quiz_responses` (JSONB)
- `narrative_content` (TEXT)
- `narrative_metadata` (JSONB) — { projectType, timeline, teamSize, industry, technologies }
- `extraction_confidence` (REAL)
- `created_at`, `completed_at` (TIMESTAMP)

**`discovery_skills`** — Extracted skills (before confirmation)
- `id` (UUID, PK)
- `session_id` (FK → discovery_sessions)
- `skill_id` (FK → skills, nullable)
- `skill_name` (VARCHAR) — Raw extracted name
- `proficiency_level` (VARCHAR) — BEGINNER, INTERMEDIATE, ADVANCED, EXPERT
- `confidence` (REAL) — 0-1, Claude's confidence
- `evidence_snippet` (TEXT) — Quote from narrative
- `created_at` (TIMESTAMP)

**`user_skill_sources`** — Lineage tracking (links userSkills to origin)
- `id` (UUID, PK)
- `user_skill_id` (FK → userSkills, UNIQUE)
- `source_type` (VARCHAR) — MANUAL, DISCOVERED, RESUME
- `source_id` (UUID) — discoverySession.id or resumeParse.id
- `created_at` (TIMESTAMP)

**`discovery_gap_analysis`** — Cached skill gaps vs. target occupation
- `id` (UUID, PK)
- `session_id` (FK → discovery_sessions)
- `occupation_id` (FK → occupations)
- `matched_skills` (JSONB) — Array of matched skills with importance
- `gap_skills` (JSONB) — Array of missing skills with importance
- `match_score` (REAL) — Percentage of required skills user has
- `created_at` (TIMESTAMP)
- **UNIQUE(session_id, occupation_id)**

---

## 🎯 Key Features

### 1. Multi-Step Journey
- Quiz → Narrative → Extraction → Confirmation
- Session persists across steps; user can pause/resume
- Progress tracking + navigation between steps

### 2. AI-Powered Skill Extraction
- Claude Sonnet analyzes experience narrative
- Returns skills with proficiency levels + confidence scores
- Evidence snippets show exactly where skill was mentioned

### 3. Hybrid Narrative Guidance
- Large textarea for freeform narrative
- Optional metadata checklist (project type, timeline, team size, etc.)
- More detail → better skill extraction

### 4. User Editable Skills
- User can edit skill names, proficiency levels
- Can remove skills that don't apply
- Can add skills manually if missed by AI
- Full control before confirmation

### 5. Evidence-Backed Skills
- Discovered skills synced as `EVIDENCE_LINKED` (not SELF_REPORTED)
- Evidence text links back to discovery session
- Skill lineage tracked via `userSkillSources` table
- Higher verification level = higher matching weight

### 6. Gap Analysis (Future)
- If target occupation selected: shows matched vs. missing skills
- Visual progress indicator (e.g., "12/18 required skills")
- Informational, not required for flow completion

---

## 🔄 Skill Lineage Tracking

When a skill is discovered and synced to passport:

1. Claude extracts skill from narrative → stored in `discovery_skills`
2. User confirms in step 3 → skill created/updated in `userSkills` with `EVIDENCE_LINKED`
3. `userSkillSource` row created linking the userSkill to its discovery session
4. Passport shows badge: "From Discovery" with link to original session

**Benefits:**
- Transparent origin (manual vs. discovered vs. resume)
- Can trace back to exact narrative quote
- Supports "refresh discovery" workflow (run again to add more skills)

---

## 🧪 Test Scenarios

### Scenario 1: Complete Discovery Flow
1. Navigate to `/dashboard/applicant/discovery`
2. Click "Start Discovery"
3. Answer quiz questions (5-8 questions)
4. Write experience narrative (2-3 paragraphs about projects)
5. Add optional metadata (project type, timeline, etc.)
6. Review extracted skills (should see 5-10 skills with confidence)
7. Edit skills as needed (change proficiency, remove irrelevant)
8. Click "Confirm & Continue"
9. See confirmation message
10. Verify skills appear in `/dashboard/applicant/passport`

### Scenario 2: Resume + Discovery Comparison
1. Upload resume to resume parser (existing M1-M3)
2. Approve resume → skills added to passport with `EVIDENCE_LINKED`
3. Run discovery with same experience narrative
4. Compare extracted skills between resume parser and discovery
5. Verify both sources show in passport with lineage tracking

### Scenario 3: Resume Skills Database
```sql
-- Check discovered skills
SELECT s.skill_name, s.proficiency_level, s.confidence
FROM discovery_skills s
WHERE s.session_id = 'your-session-id'
ORDER BY s.confidence DESC;

-- Check skill lineage
SELECT usk.id, usk.user_id, s.name as skill, uss.source_type
FROM user_skills usk
LEFT JOIN user_skill_sources uss ON uss.user_skill_id = usk.id
LEFT JOIN skills s ON s.id = usk.skill_id
WHERE uss.source_type = 'DISCOVERED'
ORDER BY usk.created_at DESC;

-- Check discovery session status
SELECT id, user_id, status, extraction_confidence, created_at
FROM discovery_sessions
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC;
```

---

## 🎨 UI/UX Details

### Discovery Hub Page
- Hero section: "Discover Your Skills" with CTA
- 4-step process diagram (visual flow)
- Alternative: "Prefer to add skills manually?" → link to passport

### Quiz Page
- Progress bar (X/6 questions)
- One question at a time
- Previous/Next navigation
- Skip option → go directly to next step

### Narrative Page
- Large textarea (primary input)
- Optional metadata section (collapsible)
- Example narrative (shows format)
- Progress indication
- Extraction happens automatically on "Continue"

### Review Page
- Extracted skills in editable table
- Columns: Skill | Proficiency | Confidence (visual bar) | Evidence | Actions
- Can edit each skill or remove
- "Confirm & Continue" button
- Info card with tips

### Confirmation Page
- Success message with checkmark
- "What's Next?" section with 4 cards
- Buttons to: Passport, Coach, Dashboard
- Pro tips for future use

---

## ⚙️ Configuration & Tuning

### Claude Model Version
- Currently using: `claude-3-5-sonnet-20241022`
- Update in `src/lib/discovery-llm.ts` line 70 if newer model available

### Skill Extraction Prompt
- Fine-tune in `src/lib/discovery-llm.ts`, `buildExtractionPrompt()` function
- Controls: proficiency level options, confidence scoring logic, skill normalization

### Quiz Questions
- Customize in `src/app/dashboard/applicant/discovery/quiz/page.tsx`, `QUIZ_QUESTIONS` array
- Add/remove questions as needed

### Narrative Metadata Fields
- Customize in `src/app/dashboard/applicant/discovery/narrative/page.tsx`, optional checklist section
- Maps to `narrativeMetadata` JSONB in database

---

## 📊 Metrics & Monitoring

### Usage Metrics
- `discovery_sessions` table: total sessions, completion rate
- `discovery_skills` table: avg skills extracted per session, confidence distribution
- `user_skill_sources` table: % of skills by source (MANUAL vs. DISCOVERED vs. RESUME)

### Quality Metrics
- Average `extraction_confidence` across all sessions
- % of skills user edits after AI extraction
- % of sessions that reach completion step

### Cost Tracking
- Claude API calls: 1 per narrative (during step 2→3)
- Token usage: ~1500 input tokens per narrative, ~500 output tokens
- Estimate: ~$0.01-0.02 per discovery session

---

## 🚀 Next Steps (M5+)

### Immediate (M5)
- Gap analysis UI: Show matched/missing skills for target occupation
- Skill verification UI: Link evidence files to discovered skills
- Bulk skill confirmation: Update multiple skills at once

### Short-term (M6)
- Learning path recommendations: "To close gaps, consider these courses"
- Multi-session aggregation: "In your last 3 discoveries, you've mentioned Python X times"
- Red Seal credential mapping: "Your skills match these Red Seal trades"

### Medium-term (M7+)
- Peer learning circles: "Meet others discovering similar skills"
- Mentorship matching: "Your profile matches X mentors"
- Career pathway visualization: "You're 6 skills away from {target role}"

---

## 📞 Debugging & Support

### Common Issues

**"No skills extracted"**
- → Narrative was too vague. Suggest adding specific project details, technologies, outcomes.
- → Claude may not recognize informal skill names. Normalize to canonical terms.

**"Wrong proficiency level"**
- → Context in narrative didn't clearly indicate level. Add more detail (e.g., "led team", "built from scratch").

**"Confidence scores are low"**
- → Narrative mentions skills casually without demonstrating them. Request project examples.

### Logging & Debugging
- Check `auditLogs` table for `DISCOVERY_SESSION_CONFIRMED` actions
- View raw extraction in `discovery_skills` table: `evidence_snippet` shows Claude's source
- Check Claude API tokens/cost in application logs (if logging added)

---

**Status**: ✅ Milestone 4 complete. Interactive Skill Discovery Dashboard fully functional.

Get started: **http://localhost:3000/dashboard/applicant/discovery**
