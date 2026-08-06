CREATE TYPE "public"."opportunity_type" AS ENUM('JOB', 'CO_OP', 'INTERNSHIP', 'MICRO_INTERNSHIP', 'APPRENTICESHIP', 'PRACTICUM');--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "opportunity_type" "opportunity_type" DEFAULT 'JOB' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "duration_weeks" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "is_credit_eligible" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "estimated_hours_per_week" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "application_deadline" timestamp;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "is_paid" boolean;