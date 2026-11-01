import { afterEach, describe, expect, it, vi } from "vitest";

import {
  billAppliesTo,
  billStatus,
  candidateWindow,
  defaultPaidOn,
  dueDateFor,
  maxSelectablePeriod,
  monthSummary,
  parsePeriod,
  periodLastDay,
  rankLinkCandidates,
  scoreCandidate,
  shiftPeriod,
  sortMonthItems,
  todayAR,
  type CandidateExpense,
  type FixedBillLike,
  type FixedBillPaymentLike,
} from "@/lib/fixed-bills";

const CAT_SERVICIOS = "11111111-1111-4111-8111-111111111111";
const CAT_OTRA = "22222222-2222-4222-8222-222222222222";

function bill(over: Partial<FixedBillLike> = {}): FixedBillLike {
  return {
    id: "bill-1",
    name: "Teléfono",
    amountCents: 1_500_000,
    currency: "ARS",
    categoryId: CAT_SERVICIOS,
    dueDay: 10,
    active: true,
    createdAt: new Date("2026-10-15T12:00:00-03:00"),
    ...over,
  };
}

function payment(over: Partial<FixedBillPaymentLike> = {}): FixedBillPaymentLike {
  return {
    billId: "bill-1",
    period: "2026-11-01",
    amountCents: 1_620_000,
    currency: "ARS",
    paidOn: "2026-11-05",
    expenseId: null,
    createdExpense: false,
    ...over,
  };
}

function expense(over: Partial<CandidateExpense> = {}): CandidateExpense {
  return {
    id: "exp-1",
    amountCents: 9_999_999,
    currency: "USD",
    categoryId: CAT_OTRA,
    description: "Supermercado",
    entity: null,
    spentOn: "2026-11-08",
    ...over,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

// ─── CA1 ───────────────────────────────────────────────
describe("CA1 parsePeriod", () => {
  it('debería devolver "2026-11-01" para "2026-11"', () => {
    expect(parsePeriod("2026-11")).toBe("2026-11-01");
  });

  it("debería usar el mes actual en hora de Argentina para entradas inválidas (no el de UTC)", () => {
    vi.useFakeTimers();
    // 2026-11-30 23:30 en Buenos Aires = 2026-12-01 02:30 UTC
    vi.setSystemTime(new Date("2026-11-30T23:30:00-03:00"));
    expect(parsePeriod("2026-13")).toBe("2026-11-01");
    expect(parsePeriod("abc")).toBe("2026-11-01");
    expect(parsePeriod(undefined)).toBe("2026-11-01");
    expect(parsePeriod("2026-00")).toBe("2026-11-01");
    expect(parsePeriod("")).toBe("2026-11-01");
  });

  it("todayAR debería devolver la fecha de Buenos Aires", () => {
    expect(todayAR(new Date("2026-12-01T02:30:00Z"))).toBe("2026-11-30");
    expect(todayAR(new Date("2026-12-01T03:30:00Z"))).toBe("2026-12-01");
  });
});

describe("helpers de período", () => {
  it("periodLastDay contempla meses de 28/30/31 días y bisiestos", () => {
    expect(periodLastDay("2026-02-01")).toBe("2026-02-28");
    expect(periodLastDay("2028-02-01")).toBe("2028-02-29");
    expect(periodLastDay("2026-11-01")).toBe("2026-11-30");
    expect(periodLastDay("2026-12-01")).toBe("2026-12-31");
  });

  it("dueDateFor usa min(dueDay, último día) y null sin dueDay", () => {
    expect(dueDateFor("2026-11-01", 10)).toBe("2026-11-10");
    expect(dueDateFor("2026-02-01", 31)).toBe("2026-02-28");
    expect(dueDateFor("2026-11-01", null)).toBeNull();
  });

  it("shiftPeriod cruza años", () => {
    expect(shiftPeriod("2026-12-01", 1)).toBe("2027-01-01");
    expect(shiftPeriod("2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftPeriod("2026-11-01", 0)).toBe("2026-11-01");
  });

  it("CA21: maxSelectablePeriod es el mes siguiente al actual", () => {
    expect(maxSelectablePeriod("2026-11-30")).toBe("2026-12-01");
    expect(maxSelectablePeriod("2026-12-15")).toBe("2027-01-01");
  });
});

// ─── CA2 ───────────────────────────────────────────────
describe("CA2 billAppliesTo", () => {
  it("un fijo creado el 2026-10-15 aplica a octubre y noviembre, no a septiembre", () => {
    const b = bill();
    expect(billAppliesTo(b, "2026-10-01")).toBe(true);
    expect(billAppliesTo(b, "2026-11-01")).toBe(true);
    expect(billAppliesTo(b, "2026-09-01")).toBe(false);
  });

  it("usa el mes de creación en hora de Argentina", () => {
    // 2026-11-01 01:00 UTC = 2026-10-31 22:00 en Buenos Aires -> creado en octubre
    const b = bill({ createdAt: new Date("2026-11-01T01:00:00Z") });
    expect(billAppliesTo(b, "2026-10-01")).toBe(true);
  });

  it("acepta createdAt como string ISO", () => {
    const b = bill({ createdAt: "2026-10-15T15:00:00.000Z" });
    expect(billAppliesTo(b, "2026-10-01")).toBe(true);
    expect(billAppliesTo(b, "2026-09-01")).toBe(false);
  });

  it("un fijo archivado (active=false) no aplica a meses sin pago", () => {
    const b = bill({ active: false });
    expect(billAppliesTo(b, "2026-12-01")).toBe(false);
    expect(billAppliesTo(b, "2026-12-01", null)).toBe(false);
  });

  it("un fijo archivado sigue apareciendo en los meses con pago registrado", () => {
    const b = bill({ active: false });
    const p = payment({ period: "2026-10-01" });
    expect(billAppliesTo(b, "2026-10-01", p)).toBe(true);
  });
});

// ─── CA3 ───────────────────────────────────────────────
describe("CA3 billStatus", () => {
  const b = bill({ dueDay: 10 });

  it("sin pago y today = día de vencimiento -> pendiente", () => {
    expect(billStatus(b, null, "2026-11-01", "2026-11-10")).toBe("pendiente");
  });

  it("sin pago y today > vencimiento -> vencido", () => {
    expect(billStatus(b, null, "2026-11-01", "2026-11-11")).toBe("vencido");
  });

  it("con pago -> pagado sin importar la fecha", () => {
    const p = payment();
    expect(billStatus(b, p, "2026-11-01", "2026-11-01")).toBe("pagado");
    expect(billStatus(b, p, "2026-11-01", "2027-05-20")).toBe("pagado");
  });

  it("CA14: un pago cuyo gasto fue borrado (expenseId null) sigue pagado", () => {
    const p = payment({ expenseId: null, createdExpense: true });
    expect(billStatus(b, p, "2026-11-01", "2026-12-20")).toBe("pagado");
  });

  it("due_day = 31 en febrero usa el último día del mes", () => {
    const b31 = bill({ dueDay: 31 });
    expect(billStatus(b31, null, "2026-02-01", "2026-02-28")).toBe("pendiente");
    expect(billStatus(b31, null, "2026-02-01", "2026-03-01")).toBe("vencido");
  });

  it("sin due_day nunca da vencido (ni en meses pasados)", () => {
    const nb = bill({ dueDay: null });
    expect(billStatus(nb, null, "2026-11-01", "2026-11-30")).toBe("pendiente");
    expect(billStatus(nb, null, "2026-09-01", "2026-11-30")).toBe("pendiente");
  });

  it("meses pasados no pagados con due_day cuentan como vencido", () => {
    expect(billStatus(b, null, "2026-10-01", "2026-11-02")).toBe("vencido");
  });

  it("el mes siguiente (futuro) sin pagar es pendiente", () => {
    expect(billStatus(b, null, "2026-12-01", "2026-11-30")).toBe("pendiente");
  });

  it("CA13: al quitar el pago vuelve a pendiente/vencido", () => {
    expect(billStatus(b, payment(), "2026-11-01", "2026-11-20")).toBe("pagado");
    expect(billStatus(b, null, "2026-11-01", "2026-11-20")).toBe("vencido");
    expect(billStatus(b, null, "2026-11-01", "2026-11-05")).toBe("pendiente");
  });
});

// ─── CA4 ───────────────────────────────────────────────
describe("CA4 monthSummary", () => {
  it("suma por moneda: pagados con el monto real y pendientes/vencidos con el estimado", () => {
    const telefono = bill({ id: "b1", amountCents: 1_500_000 });
    const internet = bill({ id: "b2", name: "Internet", amountCents: 2_000_000, dueDay: 1 });
    const gym = bill({ id: "b3", name: "Gimnasio", amountCents: 3_000_000, dueDay: null });
    const netflix = bill({ id: "b4", name: "Netflix", amountCents: 1_000, currency: "USD" });
    const icloud = bill({ id: "b5", name: "iCloud", amountCents: 300, currency: "USD" });

    const s = monthSummary([
      { bill: telefono, payment: payment({ billId: "b1", amountCents: 1_620_000 }) },
      { bill: internet, payment: null }, // vencido -> estimado
      { bill: gym, payment: null }, // pendiente -> estimado
      {
        bill: netflix,
        payment: payment({ billId: "b4", amountCents: 1_099, currency: "USD" }),
      },
      { bill: icloud, payment: null },
    ]);

    expect(s.paidCount).toBe(2);
    expect(s.total).toBe(5);
    expect(s.byCurrency).toEqual({
      ARS: { paidCents: 1_620_000, pendingCents: 5_000_000 },
      USD: { paidCents: 1_099, pendingCents: 300 },
    });
  });

  it("el monto pagado se agrupa por la moneda del pago (vínculo con gasto en otra moneda)", () => {
    const b = bill({ currency: "ARS" });
    const s = monthSummary([
      { bill: b, payment: payment({ amountCents: 2_000, currency: "USD" }) },
    ]);
    expect(s.paidCount).toBe(1);
    expect(s.total).toBe(1);
    expect(s.byCurrency).toEqual({ USD: { paidCents: 2_000, pendingCents: 0 } });
  });

  it("lista vacía", () => {
    expect(monthSummary([])).toEqual({ paidCount: 0, total: 0, byCurrency: {} });
  });
});

// ─── CA5 ───────────────────────────────────────────────
describe("CA5 scoreCandidate", () => {
  const b = bill({ name: "Teléfono", amountCents: 1_500_000, currency: "ARS", categoryId: CAT_SERVICIOS });

  it("0 puntos si no coincide nada", () => {
    expect(scoreCandidate(b, expense())).toBe(0);
  });

  it("+40 por misma categoría", () => {
    expect(scoreCandidate(b, expense({ categoryId: CAT_SERVICIOS }))).toBe(40);
  });

  it("un fijo sin categoría no suma por categoría", () => {
    const nb = bill({ categoryId: null });
    expect(scoreCandidate(nb, expense({ categoryId: CAT_SERVICIOS }))).toBe(0);
  });

  it("+30 si la descripción contiene el nombre, sin distinguir mayúsculas ni tildes", () => {
    expect(scoreCandidate(b, expense({ description: "Pago TELEFONO Personal" }))).toBe(30);
    expect(scoreCandidate(b, expense({ description: "teléfono" }))).toBe(30);
  });

  it("+30 si la entidad contiene el nombre (y no suma dos veces)", () => {
    const mov = bill({ name: "Movistar" });
    expect(scoreCandidate(mov, expense({ entity: "MOVISTAR" }))).toBe(30);
    expect(
      scoreCandidate(mov, expense({ entity: "Movistar", description: "movistar abono" })),
    ).toBe(30);
  });

  it("+20 si el monto está dentro de ±20% del estimado (bordes incluidos)", () => {
    expect(scoreCandidate(b, expense({ amountCents: 1_800_000 }))).toBe(20);
    expect(scoreCandidate(b, expense({ amountCents: 1_200_000 }))).toBe(20);
    expect(scoreCandidate(b, expense({ amountCents: 1_800_001 }))).toBe(0);
    expect(scoreCandidate(b, expense({ amountCents: 1_199_999 }))).toBe(0);
  });

  it("+10 por misma moneda", () => {
    expect(scoreCandidate(b, expense({ currency: "ARS" }))).toBe(10);
  });

  it("100 cuando coincide todo", () => {
    expect(
      scoreCandidate(
        b,
        expense({
          categoryId: CAT_SERVICIOS,
          description: "Telefono",
          amountCents: 1_590_000,
          currency: "ARS",
        }),
      ),
    ).toBe(100);
  });
});

// ─── CA16 (parte pura) ─────────────────────────────────
describe("CA16 candidateWindow / rankLinkCandidates", () => {
  it("la ventana es [primer día − 5, último día + 5]", () => {
    expect(candidateWindow("2026-11-01")).toEqual({ from: "2026-10-27", to: "2026-12-05" });
    expect(candidateWindow("2026-02-01")).toEqual({ from: "2026-01-27", to: "2026-03-05" });
    expect(candidateWindow("2026-01-01")).toEqual({ from: "2025-12-27", to: "2026-02-05" });
  });

  it("filtra por ventana (bordes incluidos) y descarta gastos ya vinculados", () => {
    const b = bill();
    const out = rankLinkCandidates(b, "2026-11-01", [
      expense({ id: "in-from", spentOn: "2026-10-27" }),
      expense({ id: "out-before", spentOn: "2026-10-26" }),
      expense({ id: "in-to", spentOn: "2026-12-05" }),
      expense({ id: "out-after", spentOn: "2026-12-06" }),
      { ...expense({ id: "linked", spentOn: "2026-11-10" }), linked: true },
    ]);
    expect(out.map((c) => c.expense.id).sort()).toEqual(["in-from", "in-to"]);
  });

  it("ordena por score desc y, a igual score, por cercanía al due_day", () => {
    const b = bill({ dueDay: 10 });
    const out = rankLinkCandidates(b, "2026-11-01", [
      expense({ id: "low", spentOn: "2026-11-10" }), // 0
      expense({ id: "far", categoryId: CAT_SERVICIOS, spentOn: "2026-11-25" }), // 40, 15 días
      expense({ id: "best", categoryId: CAT_SERVICIOS, description: "Teléfono", currency: "ARS", amountCents: 1_500_000, spentOn: "2026-11-02" }), // 100
      expense({ id: "near", categoryId: CAT_SERVICIOS, spentOn: "2026-11-08" }), // 40, 2 días
    ]);
    expect(out.map((c) => c.expense.id)).toEqual(["best", "near", "far", "low"]);
    expect(out.map((c) => c.score)).toEqual([100, 40, 40, 0]);
  });

  it('marca "Sugerido" solo a los 3 mejores con score >= 50', () => {
    const b = bill();
    const strong = (id: string, day: string) =>
      expense({ id, categoryId: CAT_SERVICIOS, description: "Teléfono", spentOn: day }); // 70
    const out = rankLinkCandidates(b, "2026-11-01", [
      strong("s1", "2026-11-09"),
      strong("s2", "2026-11-11"),
      strong("s3", "2026-11-12"),
      strong("s4", "2026-11-20"),
      expense({ id: "w", categoryId: CAT_SERVICIOS, spentOn: "2026-11-10" }), // 40
    ]);
    const suggested = out.filter((c) => c.suggested).map((c) => c.expense.id);
    expect(suggested).toHaveLength(3);
    expect(suggested).not.toContain("s4");
    expect(out.find((c) => c.expense.id === "w")?.suggested).toBe(false);
  });

  it("sin candidatos devuelve []", () => {
    expect(rankLinkCandidates(bill(), "2026-11-01", [])).toEqual([]);
  });
});

// ─── CA22 (orden de la lista) ──────────────────────────
describe("CA22 sortMonthItems", () => {
  it("primero vencidos, después pendientes por due_day (sin due_day al final), al final pagados", () => {
    const today = "2026-11-12";
    const items = [
      { bill: bill({ id: "pagado", dueDay: 1 }), payment: payment({ billId: "pagado" }) },
      { bill: bill({ id: "pend-sin-dia", dueDay: null }), payment: null },
      { bill: bill({ id: "pend-20", dueDay: 20 }), payment: null },
      { bill: bill({ id: "vencido-10", dueDay: 10 }), payment: null },
      { bill: bill({ id: "pend-15", dueDay: 15 }), payment: null },
    ];
    const ids = sortMonthItems(items, "2026-11-01", today).map((i) => i.bill.id);
    expect(ids).toEqual(["vencido-10", "pend-15", "pend-20", "pend-sin-dia", "pagado"]);
  });
});

// ─── Diálogo "Ya lo pagué": fecha por defecto ──────────
describe("defaultPaidOn", () => {
  it("hoy si el período es el mes actual", () => {
    expect(defaultPaidOn(bill({ dueDay: 10 }), "2026-11-01", "2026-11-20")).toBe("2026-11-20");
  });

  it("en otro mes, el día de vencimiento (acotado al último día) o el último día", () => {
    expect(defaultPaidOn(bill({ dueDay: 10 }), "2026-10-01", "2026-11-20")).toBe("2026-10-10");
    expect(defaultPaidOn(bill({ dueDay: 31 }), "2026-02-01", "2026-11-20")).toBe("2026-02-28");
    expect(defaultPaidOn(bill({ dueDay: null }), "2026-10-01", "2026-11-20")).toBe("2026-10-31");
  });
});
