/**
 * Agrega categorías/subcategorías de GASTO nuevas a TODOS los equipos.
 * Idempotente: si el equipo ya tiene una categoría/sub con ese nombre
 * (incluso archivada), la saltea. No reactiva ni renombra nada.
 *
 *   node scripts/add-categories.mjs           -> dry run (no escribe)
 *   node scripts/add-categories.mjs --apply   -> escribe en la base
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

// --- cargar DATABASE_URL de .env ---
try {
  const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const val = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
} catch {}

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL (en .env)");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const sql = neon(process.env.DATABASE_URL);

// Categorías nuevas top-level -> subcategorías
const NEW = {
  Servicios: ["Luz", "Agua", "Gas", "Internet", "Celular", "Seguro"],
  Deporte: ["Gimnasio", "Club/Cancha", "Clases", "Equipamiento"],
  Indumentaria: ["Ropa", "Calzado", "Accesorios"],
  "Cuidado personal": ["Peluquería", "Cosmética", "Uñas", "Estética", "Perfumería"],
};

// Subs a agregar dentro de categorías que YA existen
const EXTRA_SUBS = {
  Ocio: ["Restaurante"],
};

const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();

const teams = await sql`select id, name from teams order by created_at`;
console.log(`${teams.length} equipos · ${APPLY ? "APPLY" : "DRY RUN"}\n`);

let catsCreated = 0;
let subsCreated = 0;

for (const team of teams) {
  const cats = await sql`
    select id, name from categories
    where team_id = ${team.id} and kind = 'expense'
  `;
  const existingSubs = await sql`
    select s.category_id, s.name from subcategories s
    join categories c on c.id = s.category_id
    where s.team_id = ${team.id} and c.kind = 'expense'
  `;

  const catByNorm = new Map(cats.map((c) => [norm(c.name), c]));
  const subSet = new Set(
    existingSubs.map((s) => `${s.category_id}::${norm(s.name)}`),
  );
  const log = [];

  const addSub = async (cat, subName) => {
    const key = `${cat.id}::${norm(subName)}`;
    if (subSet.has(key)) return;
    if (APPLY && cat.id !== "(new)") {
      await sql`
        insert into subcategories (team_id, category_id, name)
        values (${team.id}, ${cat.id}, ${subName})
      `;
    }
    subSet.add(key);
    subsCreated++;
    log.push(`  + sub  ${cat.name} / ${subName}`);
  };

  // 1) categorías nuevas + sus subs
  for (const [catName, subNames] of Object.entries(NEW)) {
    let cat = catByNorm.get(norm(catName));
    if (!cat) {
      if (APPLY) {
        const [row] = await sql`
          insert into categories (team_id, name, kind)
          values (${team.id}, ${catName}, 'expense')
          returning id, name
        `;
        cat = row;
      } else {
        cat = { id: "(new)", name: catName };
      }
      catByNorm.set(norm(catName), cat);
      catsCreated++;
      log.push(`  + CAT  ${catName}`);
    }
    for (const subName of subNames) await addSub(cat, subName);
  }

  // 2) subs extra dentro de categorías existentes
  for (const [catName, subNames] of Object.entries(EXTRA_SUBS)) {
    const cat = catByNorm.get(norm(catName));
    if (!cat) {
      log.push(`  · sin "${catName}" — salteo ${subNames.join(", ")}`);
      continue;
    }
    for (const subName of subNames) await addSub(cat, subName);
  }

  if (log.length) {
    console.log(`▸ ${team.name}`);
    console.log(log.join("\n") + "\n");
  }
}

console.log(
  `${APPLY ? "APLICADO" : "DRY RUN — nada escrito"} · ` +
    `${catsCreated} categorías, ${subsCreated} subcategorías`,
);
