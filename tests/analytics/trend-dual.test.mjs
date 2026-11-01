// CA7 — TrendDual: la etiqueta del pico no puede quedar centrada (media afuera) en los extremos.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { TrendDual } from "@/components/analytics/trend-dual";
import { classesOf, deepestContaining } from "../setup/helpers.mjs";

const LABELS = ["nov", "dic", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct"];
const PEAK = 2_500_000_000; // $ 25.000.000,00 -> "$25M"

function data(peakIdx) {
  return LABELS.map((label, i) => ({
    month: `2026-${String(i + 1).padStart(2, "0")}`,
    label,
    netCents: i === peakIdx ? PEAK : 10_000_000,
    incomeCents: 20_000_000,
  }));
}

function peakLabel(peakIdx) {
  const found = deepestContaining(TrendDual({ data: data(peakIdx), currency: "ARS" }), "$25M");
  assert.ok(found, "no se encontró la etiqueta del pico ($25M)");
  return found.el;
}

const centered = (cls) => cls.includes("left-1/2") && cls.includes("-translate-x-1/2");
const anchoredLeft = (el) =>
  ["left-0", "start-0"].some((c) => classesOf(el).includes(c)) || el.props.style?.left === 0;
const anchoredRight = (el) =>
  ["right-0", "end-0"].some((c) => classesOf(el).includes(c)) || el.props.style?.right === 0;

describe("TrendDual — etiqueta del pico (CA7)", () => {
  it("debería alinear la etiqueta a la izquierda cuando el pico es la primera columna", () => {
    const el = peakLabel(0);
    assert.ok(!classesOf(el).includes("-translate-x-1/2"), `sigue desplazada -50%: "${el.props.className}"`);
    assert.ok(anchoredLeft(el), `debería anclarse con left-0: "${el.props.className}"`);
  });

  it("debería alinear la etiqueta a la derecha cuando el pico es la última columna", () => {
    const el = peakLabel(LABELS.length - 1);
    assert.ok(!classesOf(el).includes("-translate-x-1/2"), `sigue desplazada -50%: "${el.props.className}"`);
    assert.ok(anchoredRight(el), `debería anclarse con right-0: "${el.props.className}"`);
  });

  it("debería mantener la etiqueta centrada cuando el pico está en una columna intermedia", () => {
    const el = peakLabel(6);
    assert.ok(centered(classesOf(el)), `en el medio debe seguir centrada: "${el.props.className}"`);
  });
});
