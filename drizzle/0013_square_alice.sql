CREATE TABLE "tg_processed_updates" (
	"update_id" bigint PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
