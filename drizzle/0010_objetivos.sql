CREATE TYPE "public"."goal_scope" AS ENUM('personal', 'shared');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'reached', 'archived');--> statement-breakpoint
CREATE TABLE "goal_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"note" text,
	"contributed_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '🎯' NOT NULL,
	"target_cents" integer NOT NULL,
	"currency" text DEFAULT 'ARS' NOT NULL,
	"scope" "goal_scope" DEFAULT 'shared' NOT NULL,
	"owner_user_id" uuid,
	"target_date" date,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "goals_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goal_contributions_goal_idx" ON "goal_contributions" USING btree ("goal_id");