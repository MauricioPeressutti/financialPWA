/**
 * Genera los PNG del icono a partir de public/icon.svg.
 *   node scripts/gen-icons.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(path.join(root, "public/icon.svg"));
const pub = (name) => path.join(root, "public", name);
const BG = "#0B132B";

async function full(size, out) {
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain", background: BG })
    .png()
    .toFile(pub(out));
  console.log("✓", out);
}

/** Maskable: contenido al ~78% centrado sobre fondo sólido (zona segura). */
async function maskable(size, out) {
  const inner = Math.round(size * 0.78);
  const icon = await sharp(svg, { density: 384 })
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const pad = Math.round((size - inner) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: icon, top: pad, left: pad }])
    .png()
    .toFile(pub(out));
  console.log("✓", out);
}

await full(192, "icon-192.png");
await full(512, "icon-512.png");
await full(180, "apple-icon.png");
await maskable(512, "icon-maskable-512.png");
