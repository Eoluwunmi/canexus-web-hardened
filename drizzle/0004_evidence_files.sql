CREATE TABLE "evidence_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_skill_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "evidence_files" ADD CONSTRAINT "evidence_files_user_skill_id_user_skills_id_fk" FOREIGN KEY ("user_skill_id") REFERENCES "public"."user_skills"("id") ON DELETE cascade ON UPDATE no action;