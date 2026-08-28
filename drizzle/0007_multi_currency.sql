CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"base" text NOT NULL,
	"quote" text NOT NULL,
	"reference" text DEFAULT 'blue' NOT NULL,
	"rate" double precision NOT NULL,
	"source" text DEFAULT 'dolarapi' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "fx_rate" double precision DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "base_amount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "fx_rate" double precision DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "base_amount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reimbursements" ADD COLUMN "currency" text DEFAULT 'ARS' NOT NULL;--> statement-breakpoint
ALTER TABLE "reimbursements" ADD COLUMN "fx_rate" double precision DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "reimbursements" ADD COLUMN "base_amount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "primary_currency" text DEFAULT 'ARS' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "currencies" jsonb DEFAULT '["ARS","USD"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "fx_reference" text DEFAULT 'blue' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rates_day_pair_idx" ON "exchange_rates" USING btree ("day","base","quote","reference");--> statement-breakpoint
-- back-fill: todo lo existente está en ARS (= moneda principal), rate 1
UPDATE "expenses" SET "base_amount_cents" = "amount_cents";--> statement-breakpoint
UPDATE "incomes" SET "base_amount_cents" = "amount_cents";--> statement-breakpoint
UPDATE "reimbursements" SET "base_amount_cents" = "amount_cents";