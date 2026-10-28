// CA3 — BarRow: la columna de % y meta no puede tener ancho fijo ni salirse de la fila.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { BarRow } from "@/components/analytics-bits";
import { classesOf, deepestContaining, textOf, walk, WRAP_ANYWHERE, WRAP_BREAK_WORD } from "../setup/helpers.mjs";

const META = "12 · $ 1.234.567,89/mov";
const render = (props = {}) =>
  BarRow({
    label: "Supermercados y almacenes del barrio",
    valueCents: 2_500_000_000,
    pct: 100,
    meta: META,
    fmt: (c) => `$ ${(c / 100).toFixed(2)}`,
    ...props,
  });

function metaNode(tree = render()) {
  const found = deepestContaining(tree, "/mov");
  assert.ok(found, "no se encontró el elemento que muestra la meta");
  return found;
}

function barTrack(tree) {
  let track = null;
  walk(tree, (el, parents) => {
    if (!track && classesOf(el).includes("bg-muted")) track = { el, parents };
  });
  assert.ok(track, "no se encontró el track de la barra (bg-muted)");
  return track;
}

describe("BarRow (CA3)", () => {
  it("debería no usar ninguna columna de ancho fijo w-16 para % y meta", () => {
    const widths = [];
    walk(render(), (el) => {
      if (classesOf(el).some((c) => /^w-\d+$/.test(c))) widths.push(el.props.className);
    });
    assert.deepEqual(widths, [], `hay elementos con ancho fijo: ${widths.join(" | ")}`);
  });

  it("debería permitir que la meta se corte en varias líneas (min-w-0 + wrap) sin truncarla", () => {
    const { el } = metaNode();
    const cls = classesOf(el);
    assert.ok(!cls.includes("truncate"), "la meta no puede truncarse con elipsis");
    assert.ok(!cls.includes("whitespace-nowrap"), "la meta no puede ser whitespace-nowrap");
    const anywhere = cls.some((c) => WRAP_ANYWHERE.includes(c));
    const breakWord = cls.some((c) => WRAP_BREAK_WORD.includes(c)) && cls.includes("min-w-0");
    assert.ok(
      anywhere || breakWord,
      `la meta necesita min-w-0 + break-words o wrap-anywhere; clases actuales: "${el.props.className}"`,
    );
  });

  it("debería reservar al menos 40% del ancho de la fila para la barra cuando comparte fila con la meta", () => {
    const tree = render();
    const track = barTrack(tree);
    const { el: metaEl, parents: metaParents } = metaNode(tree);
    const row = track.parents[track.parents.length - 1];
    const sharesRow = metaParents.includes(row);
    if (!sharesRow) return; // meta en su propia línea: la barra ocupa todo el ancho
    const cls = classesOf(track.el);
    const minPct = cls
      .map((c) => /^(?:min-w|basis)-\[(\d+)%\]$/.exec(c))
      .filter(Boolean)
      .map((m) => Number(m[1]));
    const metaCls = classesOf(metaEl);
    const metaMax = metaCls
      .map((c) => /^max-w-\[(\d+)%\]$/.exec(c))
      .filter(Boolean)
      .map((m) => Number(m[1]));
    assert.ok(
      minPct.some((p) => p >= 40) || metaMax.some((p) => p <= 60),
      "si la meta va al lado de la barra, la barra necesita min-w-[>=40%] (o la meta max-w-[<=60%])",
    );
  });

  it("debería seguir mostrando el porcentaje y la meta completos", () => {
    const all = textOf(render());
    assert.match(all, /100%/);
    assert.ok(all.includes(META), `la meta debe mostrarse completa: "${all}"`);
  });

  it("debería mantener el label truncado y el monto sin encoger (compatibilidad)", () => {
    const tree = render();
    const label = deepestContaining(tree, "Supermercados");
    assert.ok(classesOf(label.el).includes("truncate"));
    assert.ok(classesOf(label.el).includes("min-w-0"));
    const value = deepestContaining(tree, "25000000.00");
    assert.ok(classesOf(value.el).includes("shrink-0"));
  });

  it("debería funcionar sin meta (solo porcentaje)", () => {
    const found = deepestContaining(render({ meta: undefined, pct: 42 }), "42%");
    assert.ok(found, "debe mostrar el porcentaje aunque no haya meta");
  });
});
