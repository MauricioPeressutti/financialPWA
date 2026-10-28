// CA4, CA5, CA8, CA10, CA12/P1 — contratos de markup en src/app/(app)/analytics/page.tsx.
//
// La página es un Server Component async con acceso a DB y `Kpi` no se exporta,
// así que se verifica el contrato de clases sobre el código fuente.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  between,
  classAttrAfter,
  readSrc,
  tokens,
  WRAP_ANYWHERE,
  WRAP_BREAK_WORD,
} from "../setup/helpers.mjs";

const PAGE = readSrc("src/app/(app)/analytics/page.tsx");

const hasAny = (toks, list) => toks.some((t) => list.includes(t));
const wraps = (toks) => hasAny(toks, WRAP_ANYWHERE) || hasAny(toks, WRAP_BREAK_WORD);
const usesClampFont = (raw) => /text-\[clamp\(/.test(raw ?? "");

describe("Kpi (CA4)", () => {
  const kpi = between(PAGE, "function Kpi(", "function KpiGroup");
  const box = classAttrAfter(kpi, kpi.indexOf("return ("));
  const value = classAttrAfter(kpi, kpi.indexOf("{label}"));
  const sub = classAttrAfter(kpi, kpi.indexOf("{value}"));

  it("debería permitir que la caja del KPI se encoja dentro de la grilla (min-w-0)", () => {
    assert.ok(tokens(box.text).includes("min-w-0"), `caja: "${box.text}"`);
  });

  it("debería no recortar nunca el monto con elipsis", () => {
    assert.ok(!tokens(kpi).includes("truncate"), "Kpi no puede usar truncate");
    assert.ok(!tokens(kpi).includes("text-ellipsis"), "Kpi no puede usar text-ellipsis");
  });

  it("debería achicar la fuente o cortar la línea del valor para que entre en 360px", () => {
    assert.ok(
      usesClampFont(value.text) || wraps(tokens(value.text)),
      `valor sin reducción ni corte: "${value.text}"`,
    );
    assert.ok(!tokens(value.text).includes("whitespace-nowrap"));
  });

  it("debería permitir el corte de línea del sub", () => {
    assert.ok(
      usesClampFont(sub.text) || wraps(tokens(sub.text)),
      `sub sin corte: "${sub.text}"`,
    );
  });
});

describe("Balance del período (CA5)", () => {
  const bal = between(PAGE, "Balance del período", "</CardContent>");
  const num = classAttrAfter(bal, bal.indexOf("</p>"));

  it("debería reducir la fuente del balance (clamp) o permitir el corte en lugar de quedar recortado", () => {
    assert.ok(
      usesClampFont(num.text) || wraps(tokens(num.text)),
      `balance con fuente fija y sin corte: "${num.text}"`,
    );
  });

  it("debería no ocultar el número del balance (sin truncate ni overflow-hidden)", () => {
    const t = tokens(num.text);
    assert.ok(!t.includes("truncate") && !t.includes("overflow-hidden"), `"${num.text}"`);
  });
});

describe("Movimientos más grandes (CA8)", () => {
  const row = between(PAGE, "a.topMovements.map", "</Link>");
  const dateAt = row.indexOf("toLocaleDateString");
  const pAt = row.lastIndexOf("<p", dateAt);
  const line2 = classAttrAfter(row, pAt);
  const spanAt = row.indexOf("<span", line2.index);
  const firstSpan = spanAt < dateAt ? classAttrAfter(row, spanAt) : null;

  it("debería truncar o hacer wrap en la segunda línea (fecha · creador · forma de pago)", () => {
    const p = tokens(line2.text);
    const spanTruncates =
      firstSpan && firstSpan.index < dateAt && tokens(firstSpan.text).includes("truncate");
    assert.ok(
      p.includes("flex-wrap") || spanTruncates,
      `segunda línea sin flex-wrap ni truncate: <p "${line2.text}"> <span "${firstSpan?.text ?? "(sin clase)"}">`,
    );
  });

  it("debería mantener el título truncado y el monto completo (shrink-0)", () => {
    const title = classAttrAfter(row, row.indexOf("<p"));
    assert.ok(tokens(title.text).includes("truncate"), `título: "${title.text}"`);
    const amount = classAttrAfter(row, row.lastIndexOf("<span"));
    assert.ok(tokens(amount.text).includes("shrink-0"), `monto: "${amount.text}"`);
  });

  it("debería mantener la columna central encogible (min-w-0 flex-1)", () => {
    const mid = classAttrAfter(row, row.indexOf("<div"));
    const t = tokens(mid.text);
    assert.ok(t.includes("min-w-0") && t.includes("flex-1"), `"${mid.text}"`);
  });
});

describe("Consejos de la IA y Observaciones (CA10)", () => {
  it("debería cortar palabras/URLs largas en los consejos de la IA", () => {
    const advice = between(PAGE, "aiAdvice.items.map", "</section>");
    assert.ok(wraps(tokens(advice)), "los consejos necesitan break-words o wrap-anywhere");
  });

  it("debería cortar palabras/URLs largas en las observaciones", () => {
    const obs = between(PAGE, "insights.map", "</Section>");
    const html = classAttrAfter(obs, obs.indexOf("<span", obs.indexOf("{i.emoji}")));
    const spanToks = tokens(html && html.index < obs.indexOf("dangerouslySetInnerHTML") ? html.text : "");
    const all = tokens(obs);
    assert.ok(
      hasAny(all, WRAP_ANYWHERE) || (hasAny(all, WRAP_BREAK_WORD) && spanToks.includes("min-w-0")),
      "las observaciones necesitan wrap-anywhere, o break-words + min-w-0 en el texto (flex item)",
    );
  });
});

describe("Red de seguridad del contenedor de Análisis (P1 / CA12)", () => {
  const page = PAGE.slice(PAGE.indexOf("export default async function AnalyticsPage"));
  const root = classAttrAfter(page, page.indexOf("return ("));

  it("debería tener overflow-x-clip en el contenedor de la página (no en body)", () => {
    assert.ok(tokens(root.text).includes("overflow-x-clip"), `contenedor: "${root.text}"`);
  });

  it("debería no usar overflow-hidden/overflow-x-hidden (rompen sticky y tapan desbordes)", () => {
    const t = tokens(root.text);
    assert.ok(!t.includes("overflow-hidden") && !t.includes("overflow-x-hidden"), `"${root.text}"`);
  });
});
