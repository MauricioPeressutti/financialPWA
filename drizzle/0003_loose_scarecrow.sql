CREATE TYPE "public"."category_kind" AS ENUM('expense', 'income');--> statement-breakpoint
CREATE TYPE "public"."income_method" AS ENUM('efectivo', 'transferencia', 'mercadopago', 'cheque', 'otro');--> statement-breakpoint
CREATE TABLE "incomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'ARS' NOT NULL,
	"category_id" uuid NOT NULL,
	"subcategory_id" uuid,
	"method" "income_method" DEFAULT 'transferencia' NOT NULL,
	"description" text,
	"received_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "kind" "category_kind" DEFAULT 'expense' NOT NULL;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incomes_team_received_idx" ON "incomes" USING btree ("team_id","received_on");--> statement-breakpoint
CREATE INDEX "incomes_team_category_idx" ON "incomes" USING btree ("team_id","category_id");--> statement-breakpoint
INSERT INTO "categories" ("team_id", "name", "kind")
SELECT t."id", c."name", 'income'
FROM "teams" t
CROSS JOIN (VALUES ('Sueldo'), ('Ventas'), ('Freelance'), ('Extras'), ('Otros')) AS c("name")
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" x
  WHERE x."team_id" = t."id" AND x."kind" = 'income'
);