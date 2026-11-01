ALTER TYPE "public"."payment_method" ADD VALUE IF NOT EXISTS 'transferencia';--> statement-breakpoint
CREATE TABLE "fixed_bill_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"period" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text NOT NULL,
	"paid_on" date NOT NULL,
	"expense_id" uuid,
	"created_expense" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '🧾' NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'ARS' NOT NULL,
	"category_id" uuid,
	"payment_method" "payment_method" DEFAULT 'debito' NOT NULL,
	"due_day" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fixed_bill_payments" ADD CONSTRAINT "fixed_bill_payments_bill_id_fixed_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."fixed_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_bill_payments" ADD CONSTRAINT "fixed_bill_payments_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_bills" ADD CONSTRAINT "fixed_bills_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_bills" ADD CONSTRAINT "fixed_bills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_bills" ADD CONSTRAINT "fixed_bills_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fixed_bill_payments_bill_period_idx" ON "fixed_bill_payments" USING btree ("bill_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX "fixed_bill_payments_expense_idx" ON "fixed_bill_payments" USING btree ("expense_id") WHERE expense_id is not null;--> statement-breakpoint
CREATE INDEX "fixed_bills_team_user_idx" ON "fixed_bills" USING btree ("team_id","user_id");