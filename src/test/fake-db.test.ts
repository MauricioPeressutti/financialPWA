// Sanidad del arnés FakeDb (tiene que estar en VERDE siempre): demuestra que
// los fallos de los tests de gastos fijos son por falta de implementación y no
// por el doble de la DB.
import { randomUUID } from "node:crypto";

import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { categories, expenses, reimbursements } from "@/db/schema";

import { fake } from "./fake-db";

const T1 = randomUUID();
const U1 = randomUUID();

function seedExpense(over: Record<string, unknown> = {}) {
  return fake.seed(expenses, {
    teamId: T1,
    createdByUserId: U1,
    amountCents: 1000,
    categoryId: randomUUID(),
    paymentMethod: "debito",
    spentOn: "2026-11-05",
    ...over,
  });
}

describe("FakeDb (arnés de tests)", () => {
  beforeEach(() => fake.reset());

  it("aplica defaults del schema y respeta NOT NULL", async () => {
    const e = seedExpense();
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(e.currency).toBe("ARS");
    expect(e.splitMode).toBe("none");
    await expect(
      fake.db.insert(expenses).values({ teamId: T1 } as never),
    ).rejects.toMatchObject({ cause: { code: "23502" } });
  });

  it("filtra con and/or/eq/in/is null/rangos", async () => {
    const a = seedExpense({ spentOn: "2026-11-01" });
    seedExpense({ spentOn: "2026-12-10" });
    const c = seedExpense({ spentOn: "2026-11-20", teamId: randomUUID() });
    const rows = await fake.db
      .select({ id: expenses.id })
      .from(expenses)
      .where(
        and(
          eq(expenses.teamId, T1),
          gte(expenses.spentOn, "2026-10-27"),
          lte(expenses.spentOn, "2026-12-05"),
          isNull(expenses.statementId),
          or(eq(expenses.amountCents, 1000), eq(expenses.amountCents, 5)),
        ),
      );
    expect(rows).toEqual([{ id: a.id }]);
    const byIds = await fake.db
      .select()
      .from(expenses)
      .where(inArray(expenses.id, [a.id as string, c.id as string]));
    expect(byIds).toHaveLength(2);
  });

  it("soporta leftJoin con fila nula", async () => {
    const e = seedExpense();
    const rows = await fake.db
      .select({ id: expenses.id, r: reimbursements.id })
      .from(expenses)
      .leftJoin(reimbursements, eq(reimbursements.expenseId, expenses.id));
    expect(rows).toEqual([{ id: e.id, r: null }]);
  });

  it("update/delete con returning y conteo de escrituras", async () => {
    const e = seedExpense();
    const up = await fake.db
      .update(expenses)
      .set({ amountCents: 5 })
      .where(eq(expenses.id, e.id as string))
      .returning({ id: expenses.id });
    expect(up).toEqual([{ id: e.id }]);
    const none = await fake.db
      .update(expenses)
      .set({ amountCents: 7 })
      .where(eq(expenses.id, randomUUID()))
      .returning({ id: expenses.id });
    expect(none).toEqual([]);
    await fake.db.delete(expenses).where(eq(expenses.id, e.id as string));
    expect(fake.rows(expenses)).toEqual([]);
    expect(fake.writes().map((w) => w.op)).toEqual(["update", "delete"]);
  });

  it("batch es atómico y transaction tira como neon-http", async () => {
    seedExpense();
    const before = fake.snapshot();
    fake.failNext("insert", categories);
    await expect(
      fake.db.batch([
        fake.db.delete(expenses),
        fake.db.insert(categories).values({ teamId: T1, name: "X" }),
      ] as never),
    ).rejects.toThrow();
    expect(fake.snapshot()).toEqual(before);
    await expect(fake.db.transaction()).rejects.toThrow(/No transactions support/);
  });

  it("rechaza condiciones que no sabe evaluar (para no dar falsos verdes)", async () => {
    const { sql } = await import("drizzle-orm");
    await expect(
      fake.db.select().from(expenses).where(sql`lower(${expenses.description}) like 'x'`),
    ).rejects.toThrow(/no soportada/);
  });
});
