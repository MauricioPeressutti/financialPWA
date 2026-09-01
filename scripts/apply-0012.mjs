/**
 * Aplica drizzle/0012_lively_nextwave.sql (tabla card_statements + expenses.statement_id).
 *   node scripts/apply-0012.mjs
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
  new URL("../drizzle/0012_lively_nextwave.sql", import.meta.url),
  "utf8",
);

// Ejecutar sentencia por sentencia (neon-http no acepta multi-statement).
const statements = migration
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

for (const stmt of statements) {
  const head = stmt.replace(/\s+/g, " ").slice(0, 70);
  try {
    await sql.query(stmt);
    console.log("OK  ", head);
  } catch (err) {
    // "already exists" => idempotente, seguimos
    const msg = err instanceof Error ? err.message : String(err);
    if (/already exists|duplicate/i.test(msg)) {
      console.log("skip", head, "(ya existe)");
    } else {
      console.error("ERR ", head, "\n     ", msg);
      process.exit(1);
    }
  }
}

const cols = await sql`
  select column_name, data_type from information_schema.columns
  where table_name = 'card_statements' order by ordinal_position
`;
console.log("\ncard_statements:", cols.map((c) => c.column_name).join(", "));
