// Server Actions de gastos fijos con la DB en memoria (src/test/fake-db.ts),
// requireTeam y next/cache mockeados. insertExpense es el REAL (corre contra
// el FakeDb), así se verifica el gasto que efectivamente queda guardado.
import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireTeam } from "@/lib/auth";
import {
  createFixedBill,
  deleteFixedBill,
  linkFixedBillExpense,
  markFixedBillPaid,
  setFixedBillActive,
  unmarkFixedBillPaid,
  updateFixedBill,
} from "@/lib/actions/fixed-bills";
import { deleteExpense } from "@/lib/actions/expenses";
import { billAppliesTo, billStatus } from "@/lib/fixed-bills";
import { fake } from "@/test/fake-db";
import {
  T,
  TEAM1,
  TEAM2,
  USER_A,
  USER_B,
  seedBill,
  seedCategory,
  seedExpense,
  seedPayment,
  session,
} from "@/test/fixed-bills-fixtures";

vi.mock("@/db", async () => {
  const { fake } = await import("@/test/fake-db");
  return { db: fake.db, schema: await import("@/db/schema") };
});
vi.mock("@/lib/auth", () => ({
  requireTeam: vi.fn(),
  getCurrentUser: vi.fn(),
  getActiveTeam: vi.fn(),
  assertMembership: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  refresh: vi.fn(),
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
type Result = { ok: boolean; error?: string; id?: string };

const P = "2026-11-01";
const NOT_FOUND = { ok: false, error: "Fijo no encontrado" };

function loginAs(userId: string, teamId: string) {
  vi.mocked(requireTeam).mockResolvedValue(session(userId, teamId) as any);
}

/** Corre una action y, si tira, lo convierte en {ok:false} (lo que importa es el estado de la DB). */
async function settle(p: Promise<unknown>): Promise<Result> {
  try {
    return (await p) as Result;
  } catch (e) {
    return { ok: false, error: `THROWN: ${(e as Error).message}` };
  }
}

const validInput = (over: Record<string, unknown> = {}) => ({
  name: "Teléfono",
  emoji: "📱",
  amount: "15.000",
  currency: "ARS",
  categoryId: "",
  paymentMethod: "debito",
  dueDay: "10",
  ...over,
});

let catServicios: Record<string, any>;

beforeEach(() => {
  fake.reset();
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(requireTeam).mockReset();
  loginAs(USER_A, TEAM1);
  catServicios = seedCategory({ name: "Servicios", kind: "expense", teamId: TEAM1 });
});

// ─── CA6 ───────────────────────────────────────────────
describe("CA6 createFixedBill: validación", () => {
  const invalid: [string, Record<string, unknown>][] = [
    ["nombre vacío", { name: "   " }],
    ["nombre de más de 60 caracteres", { name: "x".repeat(61) }],
    ["monto 0", { amount: "0" }],
    ["monto negativo", { amount: "-5" }],
    ["monto no parseable", { amount: "abc" }],
    ["monto vacío", { amount: "" }],
    ["due_day 0", { dueDay: "0" }],
    ["due_day 32", { dueDay: "32" }],
    ["due_day no numérico", { dueDay: "diez" }],
  ];

  it.each(invalid)("debería rechazar %s sin insertar", async (_label, over) => {
    const before = fake.snapshot();
    const r = await createFixedBill(validInput(over) as any);
    expect(r.ok).toBe(false);
    expect((r as any).error).toEqual(expect.any(String));
    expect((r as any).error.length).toBeGreaterThan(0);
    expect(fake.snapshot()).toEqual(before);
  });

  it("debería rechazar una categoría de otro equipo", async () => {
    const other = seedCategory({ teamId: TEAM2, name: "Servicios" });
    const before = fake.snapshot();
    const r = await createFixedBill(validInput({ categoryId: other.id }) as any);
    expect(r.ok).toBe(false);
    expect(fake.snapshot()).toEqual(before);
  });

  it("debería rechazar una categoría de tipo income", async () => {
    const inc = seedCategory({ teamId: TEAM1, name: "Sueldo", kind: "income" });
    const before = fake.snapshot();
    const r = await createFixedBill(validInput({ categoryId: inc.id }) as any);
    expect(r.ok).toBe(false);
    expect(fake.snapshot()).toEqual(before);
  });

  it("debería rechazar una categoría inexistente", async () => {
    const before = fake.snapshot();
    const r = await createFixedBill(validInput({ categoryId: randomUUID() }) as any);
    expect(r.ok).toBe(false);
    expect(fake.snapshot()).toEqual(before);
  });
});

describe("CA6 createFixedBill: alta válida", () => {
  it("inserta con team_id y user_id de la sesión, ignorando userId/teamId del input", async () => {
    const r = await createFixedBill(
      validInput({
        categoryId: catServicios.id,
        userId: USER_B,
        teamId: TEAM2,
      }) as any,
    );
    expect(r).toEqual({ ok: true, id: expect.any(String) });
    const rows = fake.rows(T.fixedBills);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: (r as any).id,
      teamId: TEAM1,
      userId: USER_A,
      name: "Teléfono",
      emoji: "📱",
      amountCents: 1_500_000,
      currency: "ARS",
      categoryId: catServicios.id,
      paymentMethod: "debito",
      dueDay: 10,
      active: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/movimientos/fijos");
  });

  it("acepta un fijo sin categoría ni vencimiento, con defaults (emoji 🧾, débito, moneda del equipo)", async () => {
    const r = await createFixedBill({ name: "  Gimnasio  ", amount: "30000" } as any);
    expect(r.ok).toBe(true);
    const [row] = fake.rows(T.fixedBills);
    expect(row).toMatchObject({
      name: "Gimnasio",
      emoji: "🧾",
      amountCents: 3_000_000,
      currency: "ARS",
      categoryId: null,
      paymentMethod: "debito",
      dueDay: null,
      teamId: TEAM1,
      userId: USER_A,
    });
  });

  it("respeta la moneda elegida si el equipo la tiene", async () => {
    const r = await createFixedBill(validInput({ currency: "USD", amount: "10,99" }) as any);
    expect(r.ok).toBe(true);
    expect(fake.rows(T.fixedBills)[0]).toMatchObject({ currency: "USD", amountCents: 1099 });
  });

  it("acepta due_day 1 y 31 (bordes)", async () => {
    expect((await createFixedBill(validInput({ dueDay: "1" }) as any)).ok).toBe(true);
    expect((await createFixedBill(validInput({ dueDay: 31 }) as any)).ok).toBe(true);
    expect(fake.rows(T.fixedBills).map((b) => b.dueDay).sort()).toEqual([1, 31]);
  });
});

describe("updateFixedBill / setFixedBillActive (dueño)", () => {
  it("edita el fijo propio", async () => {
    const b = seedBill();
    const r = await updateFixedBill(
      b.id as string,
      validInput({ name: "Celular", amount: "18.000", categoryId: catServicios.id, dueDay: "" }) as any,
    );
    expect(r.ok).toBe(true);
    expect(fake.rows(T.fixedBills)[0]).toMatchObject({
      id: b.id,
      name: "Celular",
      amountCents: 1_800_000,
      categoryId: catServicios.id,
      dueDay: null,
      teamId: TEAM1,
      userId: USER_A,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/movimientos/fijos");
  });

  it("valida igual que el alta", async () => {
    const b = seedBill();
    const before = fake.snapshot();
    const r = await updateFixedBill(b.id as string, validInput({ amount: "0" }) as any);
    expect(r.ok).toBe(false);
    expect(fake.snapshot()).toEqual(before);
  });

  it("archiva y reactiva", async () => {
    const b = seedBill();
    expect((await setFixedBillActive(b.id as string, false)).ok).toBe(true);
    expect(fake.rows(T.fixedBills)[0].active).toBe(false);
    expect((await setFixedBillActive(b.id as string, true)).ok).toBe(true);
    expect(fake.rows(T.fixedBills)[0].active).toBe(true);
  });
});

// ─── CA7 / CA8 ─────────────────────────────────────────
describe("CA7/CA8 aislamiento por usuario y por equipo", () => {
  const scenarios: [string, () => void][] = [
    ["CA7 usuario B del mismo equipo", () => loginAs(USER_B, TEAM1)],
    ["CA8 mismo usuario con otro equipo activo (T2)", () => loginAs(USER_A, TEAM2)],
  ];

  describe.each(scenarios)("%s", (_label, login) => {
    let bill: Record<string, any>;
    let paidBill: Record<string, any>;
    let exp: Record<string, any>;

    beforeEach(() => {
      bill = seedBill({ categoryId: catServicios.id });
      paidBill = seedBill({ name: "Internet" });
      seedPayment(paidBill.id, { period: P });
      exp = seedExpense({ teamId: TEAM1 });
      // gasto en T2 para que el escenario CA8 tenga uno "propio" que intentar vincular
      seedExpense({ teamId: TEAM2 });
      login();
    });

    const attempts: [string, () => Promise<unknown>][] = [
      ["updateFixedBill", () => updateFixedBill(bill.id, validInput() as any)],
      ["setFixedBillActive", () => setFixedBillActive(bill.id, false)],
      ["deleteFixedBill", () => deleteFixedBill(bill.id)],
      [
        "markFixedBillPaid (sin gasto)",
        () =>
          markFixedBillPaid({ billId: bill.id, period: P, amount: "15000", paidOn: "2026-11-05", createExpense: false }),
      ],
      [
        "markFixedBillPaid (con gasto)",
        () =>
          markFixedBillPaid({ billId: bill.id, period: P, amount: "15000", paidOn: "2026-11-05", createExpense: true }),
      ],
      ["linkFixedBillExpense", () => linkFixedBillExpense({ billId: bill.id, period: P, expenseId: exp.id })],
      ["unmarkFixedBillPaid", () => unmarkFixedBillPaid({ billId: paidBill.id, period: P })],
    ];

    it.each(attempts)('%s responde "Fijo no encontrado" y no toca la DB', async (_name, run) => {
      const before = fake.snapshot();
      const r = await run();
      expect(r).toEqual(NOT_FOUND);
      expect(fake.snapshot()).toEqual(before);
      expect(fake.writes()).toEqual([]);
    });
  });
});

// ─── CA9 ───────────────────────────────────────────────
describe("CA9 markFixedBillPaid sin registrar gasto", () => {
  it("crea solo la fila de pago (expense_id null, created_expense false)", async () => {
    const b = seedBill({ categoryId: catServicios.id });
    const r = await markFixedBillPaid({
      billId: b.id as string,
      period: P,
      amount: "15.000",
      paidOn: "2026-11-05",
      createExpense: false,
    });
    expect(r.ok).toBe(true);
    const pays = fake.rows(T.fixedBillPayments);
    expect(pays).toHaveLength(1);
    expect(pays[0]).toMatchObject({
      billId: b.id,
      period: "2026-11-01",
      amountCents: 1_500_000,
      currency: "ARS",
      paidOn: "2026-11-05",
      expenseId: null,
      createdExpense: false,
    });
    expect(fake.rows(T.expenses)).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith("/movimientos/fijos");
  });

  it('acepta el período como "YYYY-MM" y lo guarda como día 1', async () => {
    const b = seedBill();
    const r = await markFixedBillPaid({
      billId: b.id as string,
      period: "2026-11",
      amount: "15000",
      paidOn: "2026-11-05",
      createExpense: false,
    });
    expect(r.ok).toBe(true);
    expect(fake.rows(T.fixedBillPayments)[0].period).toBe("2026-11-01");
  });

  it("rechaza un monto inválido sin tocar la DB", async () => {
    const b = seedBill();
    const before = fake.snapshot();
    for (const amount of ["0", "abc", "-1"]) {
      const r = await markFixedBillPaid({
        billId: b.id as string,
        period: P,
        amount,
        paidOn: "2026-11-05",
        createExpense: false,
      });
      expect(r.ok).toBe(false);
    }
    expect(fake.snapshot()).toEqual(before);
  });
});

// ─── CA10 ──────────────────────────────────────────────
describe("CA10 markFixedBillPaid registrando el gasto", () => {
  it("inserta un gasto con los datos del fijo y lo vincula (created_expense true)", async () => {
    const b = seedBill({ categoryId: catServicios.id, paymentMethod: "credito" });
    const r = await markFixedBillPaid({
      billId: b.id as string,
      period: P,
      amount: "16.200",
      paidOn: "2026-11-05",
      createExpense: true,
    });
    expect(r.ok).toBe(true);

    const exps = fake.rows(T.expenses);
    expect(exps).toHaveLength(1);
    expect(exps[0]).toMatchObject({
      teamId: TEAM1,
      createdByUserId: USER_A,
      amountCents: 1_620_000,
      currency: "ARS",
      categoryId: catServicios.id,
      paymentMethod: "credito",
      description: "Teléfono",
      spentOn: "2026-11-05",
      splitMode: "none",
    });

    const pays = fake.rows(T.fixedBillPayments);
    expect(pays).toHaveLength(1);
    expect(pays[0]).toMatchObject({
      billId: b.id,
      period: P,
      amountCents: 1_620_000,
      paidOn: "2026-11-05",
      expenseId: exps[0].id,
      createdExpense: true,
    });

    for (const path of ["/movimientos/fijos", "/", "/movimientos", "/analytics", "/esfuerzo"]) {
      expect(revalidatePath).toHaveBeenCalledWith(path);
    }
  });

  it("si el fijo no tiene categoría devuelve error y no crea nada", async () => {
    const b = seedBill({ categoryId: null });
    const before = fake.snapshot();
    const r = await markFixedBillPaid({
      billId: b.id as string,
      period: P,
      amount: "16.200",
      paidOn: "2026-11-05",
      createExpense: true,
    });
    expect(r.ok).toBe(false);
    expect((r as any).error).toEqual(expect.any(String));
    expect(fake.snapshot()).toEqual(before);
  });

  it("si falla el alta del pago no queda el gasto (atomicidad)", async () => {
    const b = seedBill({ categoryId: catServicios.id });
    fake.failNext("insert", T.fixedBillPayments);
    const r = await settle(
      markFixedBillPaid({
        billId: b.id as string,
        period: P,
        amount: "16.200",
        paidOn: "2026-11-05",
        createExpense: true,
      }),
    );
    expect(r.ok).toBe(false);
    expect(fake.rows(T.fixedBillPayments)).toHaveLength(0);
    expect(fake.rows(T.expenses)).toHaveLength(0);
  });

  it("si falla el alta del gasto no queda el pago (atomicidad)", async () => {
    const b = seedBill({ categoryId: catServicios.id });
    fake.failNext("insert", T.expenses);
    const r = await settle(
      markFixedBillPaid({
        billId: b.id as string,
        period: P,
        amount: "16.200",
        paidOn: "2026-11-05",
        createExpense: true,
      }),
    );
    expect(r.ok).toBe(false);
    expect(fake.rows(T.fixedBillPayments)).toHaveLength(0);
    expect(fake.rows(T.expenses)).toHaveLength(0);
  });
});

// ─── CA11 ──────────────────────────────────────────────
describe("CA11 doble marcado del mismo fijo y período", () => {
  it('devuelve "Ya está marcado como pagado" y no crea un segundo gasto', async () => {
    const b = seedBill({ categoryId: catServicios.id });
    seedPayment(b.id, { period: P });
    const r = await settle(
      markFixedBillPaid({
        billId: b.id as string,
        period: P,
        amount: "16.200",
        paidOn: "2026-11-05",
        createExpense: true,
      }),
    );
    expect(r).toEqual({ ok: false, error: "Ya está marcado como pagado" });
    expect(fake.rows(T.fixedBillPayments)).toHaveLength(1);
    expect(fake.rows(T.expenses)).toHaveLength(0);
  });

  it("con dos requests concurrentes queda un solo pago y un solo gasto", async () => {
    const b = seedBill({ categoryId: catServicios.id });
    const input = {
      billId: b.id as string,
      period: P,
      amount: "16.200",
      paidOn: "2026-11-05",
      createExpense: true,
    };
    const results = await Promise.all([
      settle(markFixedBillPaid(input)),
      settle(markFixedBillPaid(input)),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, error: "Ya está marcado como pagado" });
    expect(fake.rows(T.fixedBillPayments)).toHaveLength(1);
    expect(fake.rows(T.expenses)).toHaveLength(1);
    expect(fake.rows(T.fixedBillPayments)[0].expenseId).toBe(fake.rows(T.expenses)[0].id);
  });

  it("vincular sobre un período ya pagado también devuelve el error", async () => {
    const b = seedBill();
    seedPayment(b.id, { period: P });
    const e = seedExpense();
    const r = await settle(linkFixedBillExpense({ billId: b.id as string, period: P, expenseId: e.id as string }));
    expect(r).toEqual({ ok: false, error: "Ya está marcado como pagado" });
    expect(fake.rows(T.fixedBillPayments)).toHaveLength(1);
  });
});

// ─── CA12 ──────────────────────────────────────────────
describe("CA12 linkFixedBillExpense", () => {
  it("rechaza un gasto de otro equipo", async () => {
    const b = seedBill();
    const foreign = seedExpense({ teamId: TEAM2 });
    const before = fake.snapshot();
    const r = await settle(
      linkFixedBillExpense({ billId: b.id as string, period: P, expenseId: foreign.id as string }),
    );
    expect(r.ok).toBe(false);
    expect(fake.snapshot()).toEqual(before);
  });

  it("rechaza un gasto inexistente", async () => {
    const b = seedBill();
    const r = await settle(linkFixedBillExpense({ billId: b.id as string, period: P, expenseId: randomUUID() }));
    expect(r.ok).toBe(false);
    expect(fake.rows(T.fixedBillPayments)).toHaveLength(0);
  });

  it('rechaza un gasto ya vinculado a otro fijo: "Ese gasto ya está vinculado a otro fijo"', async () => {
    const internet = seedBill({ name: "Internet" });
    const telefono = seedBill({ name: "Teléfono" });
    const e = seedExpense();
    seedPayment(internet.id, { period: P, expenseId: e.id });
    const r = await settle(
      linkFixedBillExpense({ billId: telefono.id as string, period: P, expenseId: e.id as string }),
    );
    expect(r).toEqual({ ok: false, error: "Ese gasto ya está vinculado a otro fijo" });
    expect(fake.rows(T.fixedBillPayments)).toHaveLength(1);
  });

  it("con dos vínculos concurrentes del mismo gasto, uno falla con el error de vínculo", async () => {
    const internet = seedBill({ name: "Internet" });
    const telefono = seedBill({ name: "Teléfono" });
    const e = seedExpense();
    const results = await Promise.all([
      settle(linkFixedBillExpense({ billId: internet.id as string, period: P, expenseId: e.id as string })),
      settle(linkFixedBillExpense({ billId: telefono.id as string, period: P, expenseId: e.id as string })),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({
      ok: false,
      error: "Ese gasto ya está vinculado a otro fijo",
    });
    expect(fake.rows(T.fixedBillPayments)).toHaveLength(1);
  });

  it("con un gasto válido crea el pago con el monto y la fecha del gasto, sin crear gastos", async () => {
    const b = seedBill();
    const e = seedExpense({ amountCents: 1_590_000, spentOn: "2026-11-08" });
    const r = await linkFixedBillExpense({ billId: b.id as string, period: P, expenseId: e.id as string });
    expect(r.ok).toBe(true);
    const pays = fake.rows(T.fixedBillPayments);
    expect(pays).toHaveLength(1);
    expect(pays[0]).toMatchObject({
      billId: b.id,
      period: P,
      amountCents: 1_590_000,
      currency: "ARS",
      paidOn: "2026-11-08",
      expenseId: e.id,
      createdExpense: false,
    });
    expect(fake.rows(T.expenses)).toHaveLength(1);
    expect(revalidatePath).toHaveBeenCalledWith("/movimientos/fijos");
  });

  it("si la moneda del gasto difiere, guarda monto y moneda del gasto (sin FX)", async () => {
    const b = seedBill({ currency: "ARS" });
    const e = seedExpense({ amountCents: 2_000, currency: "USD", fxRate: 1200 });
    const r = await linkFixedBillExpense({ billId: b.id as string, period: P, expenseId: e.id as string });
    expect(r.ok).toBe(true);
    expect(fake.rows(T.fixedBillPayments)[0]).toMatchObject({ amountCents: 2_000, currency: "USD" });
  });
});

// ─── CA13 ──────────────────────────────────────────────
describe("CA13 unmarkFixedBillPaid", () => {
  it.each([
    ["creado por 'Ya lo pagué'", true],
    ["vinculado", false],
  ])("borra el pago y deja el gasto %s intacto", async (_l, createdExpense) => {
    const b = seedBill({ categoryId: catServicios.id });
    const e = seedExpense();
    seedPayment(b.id, { period: P, expenseId: e.id, createdExpense });
    const expensesBefore = fake.rows(T.expenses);

    const r = await unmarkFixedBillPaid({ billId: b.id as string, period: P });
    expect(r.ok).toBe(true);
    expect(fake.rows(T.fixedBillPayments)).toHaveLength(0);
    expect(fake.rows(T.expenses)).toEqual(expensesBefore);
    expect(revalidatePath).toHaveBeenCalledWith("/movimientos/fijos");
  });

  it("solo borra el pago de ese período", async () => {
    const b = seedBill();
    seedPayment(b.id, { period: "2026-10-01" });
    seedPayment(b.id, { period: P });
    const r = await unmarkFixedBillPaid({ billId: b.id as string, period: P });
    expect(r.ok).toBe(true);
    expect(fake.rows(T.fixedBillPayments).map((p) => p.period)).toEqual(["2026-10-01"]);
  });

  it("después de desmarcar, el estado vuelve a pendiente/vencido y el gasto se puede volver a vincular", async () => {
    const b = seedBill({ dueDay: 10 });
    const e = seedExpense();
    seedPayment(b.id, { period: P, expenseId: e.id });

    expect((await unmarkFixedBillPaid({ billId: b.id as string, period: P })).ok).toBe(true);
    const bill = fake.rows(T.fixedBills)[0] as any;
    expect(billStatus(bill, null, P, "2026-11-05")).toBe("pendiente");
    expect(billStatus(bill, null, P, "2026-11-20")).toBe("vencido");

    const again = await linkFixedBillExpense({ billId: b.id as string, period: P, expenseId: e.id as string });
    expect(again.ok).toBe(true);
    expect(fake.rows(T.fixedBillPayments)).toHaveLength(1);
  });
});

// ─── CA14 ──────────────────────────────────────────────
describe("CA14 borrar desde Movimientos un gasto vinculado", () => {
  it("el pago queda (pagado) con expense_id null", async () => {
    const b = seedBill();
    const e = seedExpense();
    seedPayment(b.id, { period: P, expenseId: e.id, createdExpense: true });

    const r = await deleteExpense(e.id as string);
    expect(r.ok).toBe(true);

    const pays = fake.rows(T.fixedBillPayments);
    expect(pays).toHaveLength(1);
    expect(pays[0].expenseId).toBeNull();
    const bill = fake.rows(T.fixedBills)[0] as any;
    expect(billStatus(bill, pays[0] as any, P, "2026-12-20")).toBe("pagado");
  });
});

// ─── CA15 ──────────────────────────────────────────────
describe("CA15 deleteFixedBill / setFixedBillActive", () => {
  it("borra el fijo y sus pagos pero ningún gasto", async () => {
    const b = seedBill();
    const other = seedBill({ name: "Internet" });
    const e1 = seedExpense();
    const e2 = seedExpense({ description: "Teléfono" });
    seedPayment(b.id, { period: "2026-10-01", expenseId: e1.id, createdExpense: true });
    seedPayment(b.id, { period: P, expenseId: e2.id });
    seedPayment(other.id, { period: P });

    const r = await deleteFixedBill(b.id as string);
    expect(r.ok).toBe(true);
    expect(fake.rows(T.fixedBills).map((x) => x.id)).toEqual([other.id]);
    expect(fake.rows(T.fixedBillPayments).map((p) => p.billId)).toEqual([other.id]);
    expect(fake.rows(T.expenses)).toHaveLength(2);
    expect(fake.writes().some((w) => w.op === "delete" && w.table === "expenses")).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith("/movimientos/fijos");
  });

  it("archivar lo saca de los meses futuros y lo mantiene en los meses con pago", async () => {
    const b = seedBill({ createdAt: new Date("2026-10-15T15:00:00Z") });
    const oct = seedPayment(b.id, { period: "2026-10-01" });

    expect((await setFixedBillActive(b.id as string, false)).ok).toBe(true);
    const bill = fake.rows(T.fixedBills)[0] as any;
    expect(bill.active).toBe(false);
    expect(billAppliesTo(bill, "2026-10-01", oct as any)).toBe(true);
    expect(billAppliesTo(bill, "2026-12-01", null)).toBe(false);
  });
});
