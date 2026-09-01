import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  integer,
  pgEnum,
  unique,
  real,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["APPLICANT", "EMPLOYER", "MENTOR", "ADMIN"]);
export const verificationEnum = pgEnum("verification_level", [
  "SELF_REPORTED",
  "EVIDENCE_LINKED",
  "VERIFIED",
]);
export const visibilityEnum = pgEnum("visibility", ["PRIVATE", "EMPLOYERS", "PUBLIC"]);
export const jobStatusEnum = pgEnum("job_status", ["DRAFT", "OPEN", "CLOSED"]);
export const requirementEnum = pgEnum("requirement_type", ["REQUIRED", "PREFERRED"]);
export const applicationStatusEnum = pgEnum("application_status", [
  "SUBMITTED",
  "REVIEWING",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
]);
export const sessionStatusEnum = pgEnum("session_status", [
  "REQUESTED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
]);
export const consentTypeEnum = pgEnum("consent_type", [
  "FUNCTIONAL_USE",
  "EMPLOYER_VISIBILITY",
  "AI_PROCESSING",
  "MARKETING",
]);
export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "DELETED"]);
export const erasureStatusEnum = pgEnum("erasure_status", ["REQUESTED", "COMPLETED"]);
export const opportunityTypeEnum = pgEnum("opportunity_type", [
  "JOB",
  "CO_OP",
  "INTERNSHIP",
  "MICRO_INTERNSHIP",
  "APPRENTICESHIP",
  "PRACTICUM",
]);
export const incentiveTypeEnum = pgEnum("incentive_type", [
  "WAGE_SUBSIDY",
  "GRANT",
  "SCHOLARSHIP",
  "TAX_CREDIT",
  "BURSARY",
]);
export const audienceEnum = pgEnum("audience", ["APPLICANT", "EMPLOYER", "BOTH"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  location: varchar("location", { length: 200 }),
  // Soft-delete flag (Volume 6.3 / right to erasure). Deleted users are excluded from auth
  // and from employer candidate search, but the row is preserved for Applications/Sessions
  // referential integrity. Hard deletion is a separate, admin-reviewed flow — see erasureRequests.
  status: userStatusEnum("status").notNull().default("ACTIVE"),
  // Volume 8 MFA requirement targets ADMIN and "employer-admin" accounts specifically, but this
  // MVP's role model is a flat enum with no employer-admin/recruiter distinction — every EMPLOYER
  // account today is 1:1 with an employers row via employers.ownerUserId (the signup flow never
  // creates a second, non-owner EMPLOYER user for an org). This flag makes that distinction
  // explicit and future-proof rather than inferring "admin" from ownership implicitly: it's set
  // true automatically for the owner at signup (src/actions/auth.ts) and would be left false for
  // any future invited-recruiter accounts once that flow exists.
  isEmployerAdmin: boolean("is_employer_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const skills = pgTable("skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 150 }).notNull().unique(),
  category: varchar("category", { length: 100 }).notNull(),
});

export const userSkills = pgTable(
  "user_skills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
    verificationLevel: verificationEnum("verification_level").notNull().default("SELF_REPORTED"),
    evidence: text("evidence"),
    visibility: visibilityEnum("visibility").notNull().default("EMPLOYERS"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.userId, t.skillId)],
);

/** Real file attachments for a userSkills row, alongside (not replacing) the free-text
 *  `evidence` field. Object bytes live in S3-compatible storage (src/lib/storage.ts) — this
 *  row only ever holds the storage key/metadata, never the file content itself. Cascade
 *  deletes with its parent userSkills row; src/actions/evidence.ts also explicitly deletes
 *  the underlying S3 object first, since the DB cascade can't reach into the bucket. */
export const evidenceFiles = pgTable("evidence_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  userSkillId: uuid("user_skill_id").notNull().references(() => userSkills.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  storageKey: text("storage_key").notNull().unique(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const occupations = pgTable("occupations", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  nocCode: varchar("noc_code", { length: 20 }),
  description: text("description"),
  demandIndex: real("demand_index").default(0.5),
});

export const occupationSkills = pgTable(
  "occupation_skills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    occupationId: uuid("occupation_id").notNull().references(() => occupations.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
    importance: integer("importance").notNull().default(3), // 1-5
  },
  (t) => [unique().on(t.occupationId, t.skillId)],
);

export const employers = pgTable("employers", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgName: varchar("org_name", { length: 200 }).notNull(),
  industry: varchar("industry", { length: 150 }),
  sizeBand: varchar("size_band", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  employerId: uuid("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  occupationId: uuid("occupation_id").references(() => occupations.id),
  location: varchar("location", { length: 200 }),
  status: jobStatusEnum("status").notNull().default("OPEN"),
  // Work-integrated-learning typing (metadata/filtering only — does not affect matching, see
  // src/lib/matching.ts, which is deliberately untouched by this). Defaults to JOB so every
  // pre-existing row stays valid without a backfill.
  opportunityType: opportunityTypeEnum("opportunity_type").notNull().default("JOB"),
  durationWeeks: integer("duration_weeks"),
  isCreditEligible: boolean("is_credit_eligible").default(false),
  estimatedHoursPerWeek: integer("estimated_hours_per_week"),
  applicationDeadline: timestamp("application_deadline"),
  isPaid: boolean("is_paid"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobSkills = pgTable(
  "job_skills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
    requirementType: requirementEnum("requirement_type").notNull().default("REQUIRED"),
  },
  (t) => [unique().on(t.jobId, t.skillId)],
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: applicationStatusEnum("status").notNull().default("SUBMITTED"),
    coverNote: text("cover_note"),
    matchScore: real("match_score"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.jobId, t.userId)],
);

export const mentorProfiles = pgTable("mentor_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  bio: text("bio"),
  expertiseTags: text("expertise_tags"), // comma-separated for MVP simplicity
  status: varchar("status", { length: 30 }).notNull().default("ACTIVE"),
});

export const mentorSessions = pgTable("mentor_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  mentorId: uuid("mentor_id").notNull().references(() => mentorProfiles.id, { onDelete: "cascade" }),
  menteeUserId: uuid("mentee_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: sessionStatusEnum("status").notNull().default("REQUESTED"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Per-type, revocable consent (Volume 8 / PIPEDA meaningful-consent requirement).
 *  EMPLOYER_VISIBILITY is scoped per-employer via the nullable `employerId` FK — there is no
 *  single global "visible to employers" toggle. `version` lets a future consent-copy change
 *  be tracked distinctly from a simple grant/revoke of the same version. */
export const userConsents = pgTable("user_consents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  consentType: consentTypeEnum("consent_type").notNull(),
  employerId: uuid("employer_id").references(() => employers.id, { onDelete: "cascade" }),
  granted: boolean("granted").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Distinct from the soft `status = DELETED` flag on `users` — this is the record of a request
 *  for actual hard deletion, which needs cascade review before it's carried out (Volume 6.3).
 *  `userId` is nullable with `onDelete: set null` (not cascade) so the compliance record of the
 *  request/completion timeline survives even after the referenced user row is eventually
 *  hard-deleted — the same pattern used for auditLogs below. */
export const erasureRequests = pgTable("erasure_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  status: erasureStatusEnum("status").notNull().default("REQUESTED"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

/** TOTP-based MFA enrollment (Volume 8), required for ADMIN and employer-admin accounts.
 *  `secret` is NOT field-level-encrypted here — this codebase has no field-level encryption
 *  utility yet, and that's flagged explicitly as a follow-up rather than silently shipped
 *  (see SECURITY.md). Treat this table as sensitive: it's never read by anything except the
 *  MFA setup/verification flow in src/auth.ts and src/actions/mfa.ts. */
export const userMfa = pgTable("user_mfa", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  secret: text("secret").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  backupCodes: text("backup_codes"),
});

/** Append-only audit trail (Volume 8). No update/delete operations are exposed for this
 *  table anywhere in the application layer — see src/lib/audit.ts, which only ever inserts. */
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
  targetResource: text("target_resource"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Curated, admin-managed directory of grants/subsidies, filtered by audience. No hard delete
 *  by design — see src/actions/funding.ts, which only ever inserts, updates, or deactivates
 *  (isActive: false), never deletes a row. Every write is audited. */
export const fundingIncentives = pgTable("funding_incentives", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  incentiveType: incentiveTypeEnum("incentive_type").notNull(),
  audience: audienceEnum("audience").notNull(),
  jurisdiction: varchar("jurisdiction", { length: 100 }).notNull(),
  // Free text, not numeric — amounts are commonly conditional/tiered/"up to" rather than a
  // single figure, so modelling this as a number would either lose information or invite a
  // false sense of precision.
  amountDescription: varchar("amount_description", { length: 300 }).notNull(),
  eligibilitySummary: text("eligibility_summary").notNull(),
  sourceUrl: text("source_url").notNull(),
  applicationDeadline: timestamp("application_deadline"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Resume parser: uploaded resume files. One file per upload; hash-deduped at ingest time.
 *  Original file is immutably stored in S3. */
export const resumes = pgTable("resumes", {
  id: uuid("id").defaultRandom().primaryKey(),
  uploadedByUserId: uuid("uploaded_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileFormat: varchar("file_format", { length: 20 }).notNull(), // pdf, docx, txt, etc.
  storageKey: text("storage_key").notNull().unique(), // S3 object key
  fileSizeBytes: integer("file_size_bytes").notNull(),
  fileHash: varchar("file_hash", { length: 64 }).notNull(), // SHA-256 for dedup
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

/** Parse job status enum for async processing */
export const parseStatusEnum = pgEnum("parse_status", [
  "PENDING",      // Queued, not started
  "EXTRACTING",   // Text extraction in progress
  "EXTRACTED",    // Raw text ready
  "PARSING",      // LLM extraction in progress
  "COMPLETED",    // Parse successful
  "FAILED",       // Parse failed
  "NEEDS_REVIEW", // Completed but low confidence fields need human review
]);

/** Resume parse results. One per resume. Stores structured extracted data + confidence + provenance. */
export const resumeParses = pgTable("resume_parses", {
  id: uuid("id").defaultRandom().primaryKey(),
  resumeId: uuid("resume_id").notNull().unique().references(() => resumes.id, { onDelete: "cascade" }),
  status: parseStatusEnum("status").notNull().default("PENDING"),
  // Raw extracted JSON matching the spec schema
  extractedData: jsonb("extracted_data"), // Full parse result object
  // Provenance: per-field locations in source document (for review UI highlighting)
  provenance: jsonb("provenance"), // Array of { field_path, page, bbox, text_span }
  // Quality metrics
  overallConfidence: real("overall_confidence").default(0),
  fieldConfidence: jsonb("field_confidence"), // { "identity.full_name": 0.98, ... }
  needsReview: boolean("needs_review").notNull().default(false),
  reviewReasons: text("review_reasons"), // Pipe-separated list of issues
  // Error tracking
  errorMessage: text("error_message"),
  // Versioning
  parsingVersion: varchar("parsing_version", { length: 50 }).default("1.0"), // For reproducibility
  parsedAt: timestamp("parsed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** User corrections to parsed data. Append-only, linked to resumeParse.
 *  This becomes the labeled dataset for evaluation and future model tuning. */
export const parseCorrections = pgTable("parse_corrections", {
  id: uuid("id").defaultRandom().primaryKey(),
  parseId: uuid("parse_id").notNull().references(() => resumeParses.id, { onDelete: "cascade" }),
  correctedByUserId: uuid("corrected_by_user_id").notNull().references(() => users.id, { onDelete: "set null" }),
  fieldPath: text("field_path").notNull(), // e.g., "identity.full_name", "experience[0].title"
  originalValue: text("original_value"), // What the parser extracted
  correctedValue: text("corrected_value").notNull(), // What the human provided
  notes: text("notes"), // Why they corrected it
  correctedAt: timestamp("corrected_at").defaultNow().notNull(),
});

/** Cost tracking for LLM + OCR per resume. For billing/reporting. */
export const parseCosts = pgTable("parse_costs", {
  id: uuid("id").defaultRandom().primaryKey(),
  parseId: uuid("parse_id").notNull().unique().references(() => resumeParses.id, { onDelete: "cascade" }),
  llmCostUsd: real("llm_cost_usd").default(0), // Claude API token cost
  ocrCostUsd: real("ocr_cost_usd").default(0), // Tesseract or cloud OCR cost
  totalCostUsd: real("total_cost_usd").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Skill discovery sessions: multi-step journey (quiz → narrative → extraction → confirmation).
 *  Tracks user's discovery progress separately from manual passport entry (resumeParses).
 *  Status tracks the current step: ACTIVE (in progress), COMPLETED (synced to passport), ABANDONED. */
export const discoverySessionStatusEnum = pgEnum("discovery_session_status", [
  "ACTIVE",
  "COMPLETED",
  "ABANDONED",
]);

export const discoverySessions = pgTable("discovery_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: discoverySessionStatusEnum("status").notNull().default("ACTIVE"),
  targetOccupationId: uuid("target_occupation_id").references(() => occupations.id, { onDelete: "set null" }),
  // Optional: Link to resume if user uploaded one during discovery
  linkedResumeParseId: uuid("linked_resume_parse_id").references(() => resumeParses.id, { onDelete: "set null" }),
  // Step 1: Quiz responses (JSONB stores answers like { "currentRole": "...", "yearsExp": 5, "interests": [...] })
  quizResponses: jsonb("quiz_responses"),
  // Step 2: Experience narrative + optional metadata (project type, timeline, team size, etc.)
  narrativeContent: text("narrative_content"),
  narrativeMetadata: jsonb("narrative_metadata"), // { projectType: "...", timeline: "...", teamSize: "...", ... }
  // Step 3-4: Overall confidence of extraction + status
  extractionConfidence: real("extraction_confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

/** Skills discovered during a discovery session.
 *  Stores extracted skills before confirmation (step 3 approval).
 *  Once confirmed, skills are created in userSkills table with EVIDENCE_LINKED level. */
export const discoverySkills = pgTable("discovery_skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => discoverySessions.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id").references(() => skills.id, { onDelete: "set null" }),
  skillName: varchar("skill_name", { length: 150 }).notNull(), // Raw extracted skill name
  proficiencyLevel: varchar("proficiency_level", { length: 50 }).notNull().default("INTERMEDIATE"), // BEGINNER, INTERMEDIATE, ADVANCED, EXPERT
  confidence: real("confidence").notNull().default(0.5), // Claude's confidence (0-1)
  evidenceSnippet: text("evidence_snippet"), // Exact quote from narrative supporting this skill
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Lineage tracking: links userSkills to their origin (manual entry, discovery session, or resume parse).
 *  Allows "Show where this skill came from" in passport UI without modifying userSkills schema.
 *  Example: userSkillId=123, sourceType='DISCOVERED', sourceId=sessionId. */
export const userSkillSources = pgTable(
  "user_skill_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userSkillId: uuid("user_skill_id").notNull().references(() => userSkills.id, { onDelete: "cascade" }),
    sourceType: varchar("source_type", { length: 50 }).notNull(), // MANUAL, DISCOVERED, RESUME
    sourceId: uuid("source_id"), // discoverySession.id or resumeParse.id (null for MANUAL)
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.userSkillId)],
);

/** Gap analysis: cached matched/missing skills vs. target occupation for a discovery session.
 *  Populated at step 4 to show user which required skills they have/lack for their target role.
 *  Refreshed when user selects a new target occupation during discovery. */
export const discoveryGapAnalysis = pgTable(
  "discovery_gap_analysis",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id").notNull().references(() => discoverySessions.id, { onDelete: "cascade" }),
    occupationId: uuid("occupation_id").notNull().references(() => occupations.id, { onDelete: "cascade" }),
    matchedSkills: jsonb("matched_skills").notNull(), // Array of { skillName, importance }
    gapSkills: jsonb("gap_skills").notNull(), // Array of { skillName, importance }
    matchScore: real("match_score").notNull().default(0), // % of required skills user has
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.sessionId, t.occupationId)],
);
