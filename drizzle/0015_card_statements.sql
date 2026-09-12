CREATE TYPE "public"."card_statement_status" AS ENUM('pending', 'reminder_only', 'imported', 'paid', 'dismissed');--> statement-breakpoint
CREATE TABLE "card_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"bank" text,
	"brand" text,
	"last4" text,
	"label" text NOT NULL,
	"closing_date" date,
	"due_date" date NOT NULL,
	"total_ars_cents" bigint DEFAULT 0 NOT NULL,
	"total_usd_cents" bigint DEFAULT 0 NOT NULL,
	"min_payment_ars_cents" bigint,
	"status" "card_statement_status" DEFAULT 'pending' NOT NULL,
	"raw" jsonb,
	"import_log" jsonb,
	"reminded_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "statement_id" uuid;--> statement-breakpoint
ALTER TABLE "card_statements" ADD CONSTRAINT "card_statements_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_statements" ADD CONSTRAINT "card_statements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_statements_team_due_idx" ON "card_statements" USING btree ("team_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "card_statements_dedupe_idx" ON "card_statements" USING btree ("team_id","bank","last4","closing_date");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_statement_id_card_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."card_statements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_statement_idx" ON "expenses" USING btree ("statement_id");