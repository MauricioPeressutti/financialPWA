// Queries de lectura de gastos fijos (CA7/CA8 "leer", CA2, CA16) contra el FakeDb.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listFixedBillsForMonth, listLinkCandidates } from "@/lib/fixed-bills-queries";
import { fake } from "@/test/fake-db";
import {
  TEAM1,
  TEAM2,
  USER_A,
  USER_B,
  seedBill,
  seedCategory,
  seedExpense,
  seedPayment,
} from "@/test/fixed-bills-fixtures";

vi.mock("@/db", async () => {
  const { fake } = await import("@/test/fake-db");
  return { db: fake.db, schema: await import("@/db/schema") };
});

const P = "2026-11-01";

beforeEach(() => fake.reset());

describe("listFixedBillsForMonth", () => {
  it("CA7: cada usuario ve solo sus fijos", async () => {
    const a = seedBill({ userId: USER_A, name: "Teléfono A" });
    const b = seedBill({ userId: USER_B, name: "Teléfono B" });
    const forB = await listFixedBillsForMonth(TEAM1, USER_B, P);
    expect(forB.map((r) => r.bill.id)).toEqual([b.id]);
    const forA = await listFixedBillsForMonth(TEAM1, USER_A, P);
    expect(forA.map((r) => r.bill.id)).toEqual([a.id]);
  });

  it("CA8: con el equipo T2 no aparecen los fijos del mismo usuario en T1", async () => {
    seedBill({ teamId: TEAM1, userId: USER_A });
    const t2 = seedBill({ teamId: TEAM2, userId: USER_A, name: "Gimnasio" });
    const rows = await listFixedBillsForMonth(TEAM2, USER_A, P);
    expect(rows.map((r) => r.bill.id)).toEqual([t2.id]);
  });

  it("adjunta el pago del período (y solo ese)", async () => {
    const bill = seedBill();
    seedPayment(bill.id, { period: "2026-10-01", amountCents: 111 });
    const nov = seedPayment(bill.id, { period: P, amountCents: 1_620_000 });
    const rows = await listFixedBillsForMonth(TEAM1, USER_A, P);
    expect(rows).toHaveLength(1);
    expect(rows[0].payment).toMatchObject({ id: nov.id, period: P, amountCents: 1_620_000 });
    const dec = await listFixedBillsForMonth(TEAM1, USER_A, "2026-12-01");
    expect(dec).toHaveLength(1);
    expect(dec[0].payment).toBeNull();
  });

  it("CA2: no lista fijos creados después del mes", async () => {
    seedBill({ createdAt: new Date("2026-10-15T15:00:00Z") });
    expect(await listFixedBillsForMonth(TEAM1, USER_A, "2026-09-01")).toEqual([]);
    expect(await listFixedBillsForMonth(TEAM1, USER_A, "2026-10-01")).toHaveLength(1);
  });

  it("CA2/CA15: un fijo archivado aparece solo en los meses con pago", async () => {
    const bill = seedBill({ active: false });
    seedPayment(bill.id, { period: "2026-10-01" });
    expect(await listFixedBillsForMonth(TEAM1, USER_A, "2026-10-01")).toHaveLength(1);
    expect(await listFixedBillsForMonth(TEAM1, USER_A, P)).toEqual([]);
  });
});

describe("CA16 listLinkCandidates", () => {
  it("solo gastos del equipo activo, dentro de la ventana y sin vínculo previo, ordenados por score", async () => {
    const cat = seedCategory({ teamId: TEAM1 });
    const bill = seedBill({ categoryId: cat.id, dueDay: 10, amountCents: 1_500_000 });
    const otherBill = seedBill({ name: "Internet" });

    const best = seedExpense({ categoryId: cat.id, description: "Teléfono", amountCents: 1_550_000, spentOn: "2026-11-09" });
    const plain = seedExpense({ description: "Kiosco", amountCents: 50_000, spentOn: "2026-11-15" });
    const edgeFrom = seedExpense({ description: "x", amountCents: 1, currency: "USD", spentOn: "2026-10-27" });
    const edgeTo = seedExpense({ description: "x", amountCents: 1, currency: "USD", spentOn: "2026-12-05" });
    seedExpense({ spentOn: "2026-10-26" }); // fuera de ventana
    seedExpense({ spentOn: "2026-12-06" }); // fuera de ventana
    seedExpense({ teamId: TEAM2, categoryId: cat.id, description: "Teléfono", spentOn: "2026-11-09" }); // otro equipo
    const linked = seedExpense({ categoryId: cat.id, description: "Teléfono", spentOn: "2026-11-10" });
    seedPayment(otherBill.id, { period: P, expenseId: linked.id });

    const out = await listLinkCandidates(TEAM1, USER_A, bill.id as string, P);
    const ids = out.map((c) => c.expense.id);
    expect(new Set(ids)).toEqual(new Set([best.id, plain.id, edgeFrom.id, edgeTo.id]));
    expect(ids[0]).toBe(best.id);
    expect(out[0].score).toBe(100);
    expect(out[0].suggested).toBe(true);
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].score).toBeGreaterThanOrEqual(out[i].score);
    }
  });

  it("devuelve [] si el fijo no es del usuario o del equipo", async () => {
    const bill = seedBill({ userId: USER_A });
    seedExpense({ spentOn: "2026-11-09" });
    expect(await listLinkCandidates(TEAM1, USER_B, bill.id as string, P)).toEqual([]);
    expect(await listLinkCandidates(TEAM2, USER_A, bill.id as string, P)).toEqual([]);
  });
});
