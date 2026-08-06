CREATE TABLE "user_mfa" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"backup_codes" text
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_employer_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_mfa" ADD CONSTRAINT "user_mfa_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;