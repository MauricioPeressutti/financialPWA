/** Aplica drizzle/0011 (goals.target_cents + goal_contributions.amount_cents -> bigint). */
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

const cols = () => sql`
  select table_name, column_name, data_type
  from information_schema.columns
  where (table_name = 'goals' and column_name = 'target_cents')
     or (table_name = 'goal_contributions' and column_name = 'amount_cents')
  order by table_name
`;

console.log("antes:", await cols());
await sql`ALTER TABLE "goal_contributions" ALTER COLUMN "amount_cents" SET DATA TYPE bigint`;
await sql`ALTER TABLE "goals" ALTER COLUMN "target_cents" SET DATA TYPE bigint`;
console.log("después:", await cols());
