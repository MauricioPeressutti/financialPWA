/**
 * Aplica drizzle/0012_bright_barracuda.sql (expenses.source + incomes.source).
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
  new URL("../drizzle/0012_bright_barracuda.sql", import.meta.url),
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
    if (/already exists|duplicate column/i.test(msg)) {
      console.log("skip (ya existe):", stmt.slice(0, 60));
    } else {
      console.error("ERR:", msg);
      process.exit(1);
    }
  }
}

const cols = await sql`
  select table_name, column_name from information_schema.columns
  where column_name = 'source' and table_name in ('expenses','incomes')
`;
console.log("\ncolumnas source:", cols);
