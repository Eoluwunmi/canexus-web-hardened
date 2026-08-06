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
