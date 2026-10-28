// Soporte automatizado de CA9 (la verificación real es manual en iOS Safari):
// los input[type=date] del rango personalizado deben aplicar el workaround de WebKit.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { classAttrAfter, readSrc, tokens } from "../setup/helpers.mjs";

const SRC = readSrc("src/components/analytics-range.tsx");

function dateInputs() {
  const out = [];
  let i = SRC.indexOf('type="date"');
  while (i !== -1) {
    out.push(classAttrAfter(SRC, i));
    i = SRC.indexOf('type="date"', i + 1);
  }
  return out;
}

const WEBKIT_FIX = /appearance-none|\[-webkit-appearance:none\]|-webkit-date-and-time-value/;

describe("Rango personalizado — date inputs (CA9, soporte)", () => {
  it("debería haber dos input[type=date]", () => {
    assert.equal(dateInputs().length, 2);
  });

  it("debería aplicar appearance-none (o el workaround de WebKit) a cada date input", () => {
    for (const c of dateInputs()) {
      assert.match(c.text, WEBKIT_FIX, `date input sin workaround de WebKit: "${c.text}"`);
    }
  });

  it("debería mantener min-w-0 en cada input (explícito o heredado de Input) y en su columna", () => {
    const base = readSrc("src/components/ui/input.tsx");
    for (const c of dateInputs()) {
      assert.ok(tokens(c.text).includes("min-w-0") || /min-w-0/.test(base));
    }
    const labels = SRC.match(/<label className="([^"]*)"/g) ?? [];
    assert.equal(labels.length, 2);
    for (const l of labels) assert.match(l, /\bmin-w-0\b/);
  });
});
