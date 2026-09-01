ALTER TABLE "expenses" ADD COLUMN "source" text DEFAULT 'web' NOT NULL;--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "source" text DEFAULT 'web' NOT NULL;