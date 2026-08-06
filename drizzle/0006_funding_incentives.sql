CREATE TYPE "public"."audience" AS ENUM('APPLICANT', 'EMPLOYER', 'BOTH');--> statement-breakpoint
CREATE TYPE "public"."incentive_type" AS ENUM('WAGE_SUBSIDY', 'GRANT', 'SCHOLARSHIP', 'TAX_CREDIT', 'BURSARY');--> statement-breakpoint
CREATE TABLE "funding_incentives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"incentive_type" "incentive_type" NOT NULL,
	"audience" "audience" NOT NULL,
	"jurisdiction" varchar(100) NOT NULL,
	"amount_description" varchar(300) NOT NULL,
	"eligibility_summary" text NOT NULL,
	"source_url" text NOT NULL,
	"application_deadline" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
