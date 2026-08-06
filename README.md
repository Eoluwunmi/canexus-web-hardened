# CANexus — MVP Web Application

A working, full-stack MVP of CANexus: real accounts, real Postgres database, real authentication,
and functional flows for all three launch user types (Applicant, Employer, Mentor), plus an Admin
portal.

This implements a scoped slice of the CANexus Product & Technical Blueprint: Skills Passport
(including file-backed evidence, not just free text), the Transferable Skills Engine, an
explainable AI Career Coach, skills-based job posting/application — including work-integrated
learning opportunity types (co-ops, internships, micro-internships, apprenticeships, practicums)
— skills-based candidate search, mentor scheduling, a curated funding/incentives hub for both
applicants and employers, and the Volume 8 privacy/security controls (audit logging, consent
management, access/correction/erasure, admin-enforced MFA). Messaging, Learning Hub,
notifications, and the full Career Journey Map/Career Twin simulation UI are intentionally out
of scope for this first cut — see "What's not in this MVP" below.

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **Tailwind CSS v4** — custom "Skills Passport" design system (see `src/app/globals.css`)
- **Drizzle ORM** + **PostgreSQL** — chosen over Prisma because Prisma's engine binaries require
  a network fetch from a CDN that isn't available in every build environment; Drizzle is pure
  TypeScript and works identically everywhere, including Vercel's serverless functions.
- **Auth.js (NextAuth v5)** — credentials provider, bcrypt-hashed passwords, JWT sessions,
  role-based route protection via `src/proxy.ts`, TOTP-based MFA for Admin/employer-admin roles
- **Zod** for input validation on every server action
- **AWS SDK v3** (`@aws-sdk/client-s3` + presigned POST/GET) — S3-compatible object storage for
  Skills Passport evidence file attachments. Works against real AWS S3 or any S3-compatible
  provider (Cloudflare R2, Backblaze B2, MinIO, DigitalOcean Spaces).

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a Postgres database (locally via Docker/postgres.app, or a free hosted instance — see
   Deployment below) and copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in:
   - `DATABASE_URL` — your Postgres connection string
   - `AUTH_SECRET` — generate one with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — `http://localhost:3000` for local dev
   - `AUTH_TRUST_HOST=true` — required for local dev and any non-Vercel host
   - `ANTHROPIC_API_KEY` — optional; see "AI Coach" below
   - `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (and optionally
     `S3_ENDPOINT` / `S3_FORCE_PATH_STYLE` for a non-AWS provider) — **optional for local dev**,
     but required for Skills Passport evidence *file* uploads to work. Without these set, the
     rest of the app runs fine — the Passport page just can't accept file attachments (the
     free-text evidence field still works either way). See `.env.example` and `SECURITY.md` for
     the region/encryption-at-rest requirements these values need to satisfy in production.

3. Apply the database schema. Migrations are checked into `/drizzle` and generated via
   `drizzle-kit generate` — don't hand-write migration SQL, and don't use `db:push` for anything
   beyond quick local experiments (it doesn't produce a migration history):
   ```bash
   npm run db:migrate
   ```

4. (Recommended) Seed demo data — four demo accounts (applicant/employer/mentor/**admin**), a
   realistic skills taxonomy, five occupations with weighted skill requirements, sample job
   postings across several opportunity types, and a set of funding incentives:
   ```bash
   npm run db:seed
   ```
   Demo logins (password for all: `Password123!`):
   - `applicant@demo.canexus.ca`
   - `employer@demo.canexus.ca`
   - `mentor@demo.canexus.ca`
   - `admin@demo.canexus.ca`

   If `S3_BUCKET` is set before you seed, one real evidence file is uploaded to it and linked in
   the seed data so the Passport page's file viewer has something to show; if it's not set, that
   part of the seed is skipped with a console note rather than inserting a DB row that points at
   a non-existent object.

5. Run the dev server:
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000.

## Schema changes going forward

New tables/columns go in `src/db/schema.ts`, then:
```bash
npm run db:generate   # writes SQL into /drizzle, derived from the schema diff
npm run db:migrate     # applies pending migrations
```
Review the generated SQL before applying it in any shared environment — in particular check
`onDelete` behaviour on new foreign keys and that nothing destructive got swept in accidentally.

## Deploying to production

1. **Database**: provision a Postgres instance. Any of these work well with Vercel: Neon
   (neon.tech — generous free tier, serverless-friendly), Vercel Postgres, or Supabase. Copy the
   connection string. See `SECURITY.md` for the Canadian-data-residency requirement this needs to
   satisfy.

2. **Object storage**: provision an S3-compatible bucket (see `SECURITY.md` for region/encryption
   requirements) for evidence file uploads, and set the `S3_*` environment variables.

3. **Apply migrations** against your production database:
   ```bash
   DATABASE_URL="your-prod-connection-string" npm run db:migrate
   ```
   Optionally seed it too, or skip seeding and let real users sign up.

4. **Deploy to Vercel**:
   ```bash
   npx vercel
   ```
   or connect the GitHub repo in the Vercel dashboard. Set these Environment Variables in the
   Vercel project settings:
   - `DATABASE_URL`
   - `AUTH_SECRET` (generate a fresh one for production — don't reuse the local dev value)
   - `ANTHROPIC_API_KEY` (optional)
   - `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT` /
     `S3_FORCE_PATH_STYLE` if applicable
   - You do **not** need `NEXTAUTH_URL` or `AUTH_TRUST_HOST` on Vercel — Auth.js detects the
     host automatically from Vercel's request headers.

5. Once deployed, create your first real account via `/signup`, then work through `SECURITY.md`'s
   checklist before onboarding real users — several items there explicitly need verification
   against your actual hosting configuration and/or privacy-counsel review.

## AI Career Coach — how it actually works

The Coach's recommendations are never fabricated. Every reply is generated from
`src/lib/matching.ts`, which computes real, evidence-weighted scores between a user's Skills
Passport and the occupation taxonomy — the same engine that powers the dashboard's ranked
matches. This works with **zero external API dependencies**.

If you set `ANTHROPIC_API_KEY`, `src/lib/coach.ts` sends that same grounded data to Claude
(`claude-sonnet-4-6`) to phrase it more conversationally — but the underlying facts (which
occupations, which scores, which gap skills) always come from the real database query, never
from the model's own knowledge. If the API key is absent or the call fails, it falls back to the
deterministic summary automatically. This mirrors the explainability requirement in the product
blueprint (AI Architecture volume): the "why am I seeing this" affordance in the Coach UI always
reflects real grounding data.

## What's not in this MVP

Scoped out deliberately to ship a real, working core rather than a half-built everything:

- **Native iOS/Android apps** — planned for a later phase, per your direction. The API layer
  (server actions + `/api/coach`, `/api/auth/*`) can be extended with a formal REST/GraphQL layer
  for native clients when that phase starts.
- **Messaging, Notifications, Learning Hub, full Career Twin simulation UI** — all specified in
  the Blueprint but not built here. The data model has room to grow into them
  (`src/db/schema.ts`).
- **Résumé parsing** — Passport entries (and their evidence files) are added manually in this
  MVP; the AI Resume Parser is a natural next addition once real usage validates the manual flow.
- **Email delivery** (verification, notifications) — accounts are created and usable immediately;
  no transactional email provider is wired up yet.
- **Payments/billing** — no employer subscription tiers are enforced yet; all employer accounts
  currently have unlimited posting.
- **Malware scanning on uploaded evidence files** — explicitly flagged as an open item in
  `SECURITY.md`, not silently omitted. File type/size are validated, but content isn't scanned.
- **Automated test suite** — the app was manually verified end-to-end (signup → login → Skills
  Passport → evidence file upload → real match scoring → AI Coach → job posting → application →
  candidate search → mentor booking → admin audit log / verification / funding CRUD → MFA
  enrollment) against a live local Postgres instance during this build, but there's no CI test
  suite yet.

## Project structure

```
src/
  app/                    Routes (App Router)
    page.tsx              Landing page
    login/, signup/        Auth pages (login is a two-step flow when MFA is enrolled)
    dashboard/
      applicant/           Overview, Skills Passport (+ evidence files), AI Coach, Jobs
                            (filterable by opportunity type), Funding, Mentors, Settings
                            (consent, data export, delete/erasure)
      employer/             Overview/pipeline, Post a Job (opportunity type + WIL fields),
                            Candidate Search, Funding
      mentor/               Overview/session requests, Profile
      admin/                 Audit Log, Skill Verification (incl. evidence file review),
                            Funding Incentives CRUD
      mfa/                   Shared MFA enrollment page (Admin / employer-admin only)
    api/
      auth/[...nextauth]/  Auth.js route handler
      coach/                AI Coach chat endpoint
  actions/                 Server actions — passport, evidence, jobs, mentors, consent, account
                            (export/delete/erasure), mfa, admin (verification), funding
  lib/
    matching.ts            The Transferable Skills Engine — real scoring logic (untouched by
                            the opportunity-typing and funding-hub work — metadata/filtering only)
    coach.ts                AI Coach response generation
    audit.ts                Append-only audit log writer — the only thing allowed to insert
    storage.ts               S3-compatible object storage — presigned upload/download
    mfa.ts                   TOTP secret/QR/backup-code helpers
  db/
    schema.ts               Drizzle schema (Postgres)
    seed.ts                  Demo data
  auth.ts                   Auth.js configuration (incl. MFA enforcement in `authorize()`)
  proxy.ts                  Role-based route protection (Next.js 16 middleware/proxy)
drizzle/                    Generated SQL migrations (via `npm run db:generate`) — checked in,
                            not hand-written
SECURITY.md                 Infrastructure/hosting checklist (data residency, encryption,
                            evidence storage, flagged gaps) — not a substitute for privacy-
                            counsel review
```
