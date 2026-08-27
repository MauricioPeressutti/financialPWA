/**
 * Sube las variables de .env al proyecto de Vercel (production + preview + development).
 * No imprime los valores.
 *   node scripts/push-env.mjs
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");

const vars = {};
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (!m) continue;
  let val = m[2].trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  vars[m[1]] = val;
}

// URL pública: forzar la de producción
vars["NEXT_PUBLIC_APP_URL"] = "https://financial-pwa.vercel.app";

const run = (args, input) =>
  spawnSync("vercel", args, {
    input,
    encoding: "utf8",
    shell: true,
  });

for (const [name, value] of Object.entries(vars)) {
  if (!value) {
    console.log(`- ${name}: (vacío, se omite)`);
    continue;
  }
  // primero intentar quitar la que exista (idempotente)
  run(["env", "rm", name, "production", "preview", "development", "--yes"], "");
  const r = run(["env", "add", name, "production,preview,development"], value);
  const err = (r.stderr || "").replace(/<claude-code-hint[^>]*\/>/g, "").trim();
  console.log(
    `${r.status === 0 ? "OK " : "ERR"} ${name}` +
      (r.status !== 0 ? ` -> ${err.slice(0, 240) || r.error?.message || "?"}` : ""),
  );
}

console.log("\nListo. Verificá con: vercel env ls");
