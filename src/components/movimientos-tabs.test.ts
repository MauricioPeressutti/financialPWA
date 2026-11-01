// CA17: el tab "Fijos" en MovimientosTabs. Se testea la lógica de match
// (sin DOM): el componente tiene que exportar MOVIMIENTOS_TABS e
// isMovimientosTabActive(href, pathname) y usarlos para renderizar.
import { describe, expect, it } from "vitest";

import * as tabs from "@/components/movimientos-tabs";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mod = tabs as Record<string, any>;

describe("CA17 MovimientosTabs", () => {
  it("exporta MOVIMIENTOS_TABS e isMovimientosTabActive", () => {
    expect(Array.isArray(mod.MOVIMIENTOS_TABS)).toBe(true);
    expect(typeof mod.isMovimientosTabActive).toBe("function");
  });

  it('tiene tres tabs en orden: Gastos | Ingresos | Fijos', () => {
    expect(mod.MOVIMIENTOS_TABS).toEqual([
      { href: "/movimientos", label: "Gastos" },
      { href: "/movimientos/ingresos", label: "Ingresos" },
      { href: "/movimientos/fijos", label: "Fijos" },
    ]);
  });

  it('"Fijos" está activo en /movimientos/fijos y sus subrutas', () => {
    const active = mod.isMovimientosTabActive as (href: string, path: string) => boolean;
    expect(active("/movimientos/fijos", "/movimientos/fijos")).toBe(true);
    expect(active("/movimientos/fijos", "/movimientos/fijos/nuevo")).toBe(true);
    expect(active("/movimientos/fijos", "/movimientos")).toBe(false);
    expect(active("/movimientos/fijos", "/movimientos/ingresos")).toBe(false);
  });

  it('"Gastos" sigue activo solo en /movimientos exacto', () => {
    const active = mod.isMovimientosTabActive as (href: string, path: string) => boolean;
    expect(active("/movimientos", "/movimientos")).toBe(true);
    expect(active("/movimientos", "/movimientos/fijos")).toBe(false);
    expect(active("/movimientos", "/movimientos/ingresos")).toBe(false);
  });

  it('"Ingresos" no se activa en /movimientos/fijos', () => {
    const active = mod.isMovimientosTabActive as (href: string, path: string) => boolean;
    expect(active("/movimientos/ingresos", "/movimientos/ingresos")).toBe(true);
    expect(active("/movimientos/ingresos", "/movimientos/fijos")).toBe(false);
  });
});
