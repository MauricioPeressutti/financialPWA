// CA6 — Tooltip del heatmap: clamp con el ancho real del contenedor.
//
// Contrato (lógica pura, a crear en la fase GREEN):
//   src/lib/tooltip-position.ts
//   export function clampTooltipLeft(
//     x: number,              // posición del puntero relativa al contenedor
//     containerWidth: number, // ancho real del contenedor (getBoundingClientRect().width)
//     tipWidth: number,       // ancho del tooltip (medido o el máximo, 200)
//     offset?: number,        // separación del puntero, default 12
//   ): number                 // `left` en px, siempre 0 <= left <= containerWidth - tipWidth
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

import { readSrc } from "../setup/helpers.mjs";

let clampTooltipLeft;
let importError;

before(async () => {
  try {
    ({ clampTooltipLeft } = await import("@/lib/tooltip-position"));
  } catch (e) {
    importError = e;
  }
});

function fn() {
  assert.ok(
    !importError && typeof clampTooltipLeft === "function",
    `falta implementar clampTooltipLeft en src/lib/tooltip-position.ts (${importError?.code ?? importError?.message ?? "no exportada"})`,
  );
  return clampTooltipLeft;
}

// Ancho útil del CardContent: viewport - 2*16 (main px-4) - 2*16 (card spacing)
const WIDTHS = { "360px": 296, "402px": 338 };
const TIP = 200;

describe("clampTooltipLeft (CA6)", () => {
  for (const [vp, cw] of Object.entries(WIDTHS)) {
    it(`debería dejar el tooltip dentro del contenedor al tocar la celda de más a la derecha (${vp})`, () => {
      const left = fn()(cw - 4, cw, TIP);
      assert.ok(left >= 0, `left=${left} < 0`);
      assert.ok(left + TIP <= cw, `left=${left} + ${TIP} > ${cw}`);
    });

    it(`debería dejar el tooltip dentro del contenedor al tocar la celda de más a la izquierda (${vp})`, () => {
      const left = fn()(4, cw, TIP);
      assert.ok(left >= 0, `left=${left} < 0`);
      assert.ok(left + TIP <= cw, `left=${left} + ${TIP} > ${cw}`);
    });

    it(`debería respetar los bordes para cualquier posición del puntero (${vp})`, () => {
      for (let x = 0; x <= cw; x += 7) {
        const left = fn()(x, cw, TIP);
        assert.ok(left >= 0 && left + TIP <= cw, `x=${x} -> left=${left} fuera de [0, ${cw - TIP}]`);
      }
    });
  }

  it("debería ubicar el tooltip a la derecha del puntero (x + offset) cuando hay lugar", () => {
    assert.equal(fn()(20, 338, TIP), 32);
    assert.equal(fn()(20, 338, TIP, 8), 28);
  });

  it("debería devolver 0 si el tooltip es más ancho que el contenedor", () => {
    assert.equal(fn()(100, 150, TIP), 0);
  });
});

describe("SpendHeatmap usa el clamp con el ancho real (CA6)", () => {
  const src = readSrc("src/components/analytics/spend-heatmap.tsx");

  it("debería no usar el literal 280 como tope del tooltip", () => {
    assert.doesNotMatch(src, /Math\.min\(\s*tip\.x\s*\+\s*12\s*,\s*280\s*\)/);
    assert.doesNotMatch(src, /\b280\b/, "el tope no puede ser un número fijo");
  });

  it("debería usar clampTooltipLeft con el ancho medido del contenedor", () => {
    assert.match(src, /clampTooltipLeft/);
    assert.match(src, /\.width\b|offsetWidth|clientWidth/, "debe medir el ancho real del contenedor");
  });
});
