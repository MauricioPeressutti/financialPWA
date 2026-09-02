/**
 * Aplica drizzle/0013_square_alice.sql (tabla tg_processed_updates, dedupe de webhooks).
 *   node scripts/apply-0013.mjs
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const sql = neon(process.env.DATABASE_URL);
const migration = readFileSync(
  new URL("../drizzle/0013_square_alice.sql", import.meta.url),
  "utf8",
);

for (const stmt of migration
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean)) {
  try {
    await sql.query(stmt);
    console.log("OK  ", stmt.replace(/\s+/g, " ").slice(0, 70));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already exists/i.test(msg)) {
      console.log("skip (ya existe)");
    } else {
      console.error("ERR:", msg);
      process.exit(1);
    }
  }
}

const [c] = await sql`select count(*)::int n from tg_processed_updates`;
console.log("\ntg_processed_updates OK, filas:", c.n);
