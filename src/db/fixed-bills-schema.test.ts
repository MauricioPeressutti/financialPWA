// Contrato del schema de gastos fijos (CA11, CA12, CA14, CA15 y parte de CA26).
// La migración real la verifica el tester contra la DB de desarrollo.
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

/* eslint-disable @typescript-eslint/no-explicit-any */
const s = schema as Record<string, any>;

function cfg(name: "fixedBills" | "fixedBillPayments") {
  expect(s[name], `falta exportar ${name} en src/db/schema.ts`).toBeDefined();
  return getTableConfig(s[name]);
}

function col(c: ReturnType<typeof getTableConfig>, name: string) {
  const found = c.columns.find((x) => x.name === name);
  expect(found, `falta la columna ${c.name}.${name}`).toBeDefined();
  return found!;
}

function fkOn(c: ReturnType<typeof getTableConfig>, column: string) {
  const fk = c.foreignKeys.find((f) =>
    f.reference().columns.some((x) => x.name === column),
  );
  expect(fk, `falta la FK de ${c.name}.${column}`).toBeDefined();
  return { fk: fk!, ref: fk!.reference() };
}

describe("schema fixed_bills", () => {
  it("tiene las columnas, defaults y nullables de la spec", () => {
    const c = cfg("fixedBills");
    expect(c.name).toBe("fixed_bills");
    expect(col(c, "team_id").notNull).toBe(true);
    expect(col(c, "user_id").notNull).toBe(true);
    expect(col(c, "name").notNull).toBe(true);
    expect(col(c, "emoji").default).toBe("🧾");
    expect(col(c, "amount_cents").notNull).toBe(true);
    expect(col(c, "amount_cents").columnType).toMatch(/BigInt/i);
    expect(col(c, "currency").notNull).toBe(true);
    expect(col(c, "category_id").notNull).toBe(false);
    expect(col(c, "payment_method").default).toBe("debito");
    expect(col(c, "due_day").notNull).toBe(false);
    expect(col(c, "active").default).toBe(true);
    col(c, "created_at");
  });

  it("FKs: team y user con cascade, categoría nullable", () => {
    const c = cfg("fixedBills");
    const team = fkOn(c, "team_id");
    expect(getTableConfig(team.ref.foreignTable).name).toBe("teams");
    expect(team.fk.onDelete).toBe("cascade");
    const user = fkOn(c, "user_id");
    expect(getTableConfig(user.ref.foreignTable).name).toBe("users");
    expect(user.fk.onDelete).toBe("cascade");
    const cat = fkOn(c, "category_id");
    expect(getTableConfig(cat.ref.foreignTable).name).toBe("categories");
  });

  it("índice (team_id, user_id)", () => {
    const c = cfg("fixedBills");
    const idx = c.indexes.find((i) => {
      const cols = i.config.columns.map((x: any) => x.name);
      return cols[0] === "team_id" && cols[1] === "user_id";
    });
    expect(idx).toBeDefined();
  });
});

describe("schema fixed_bill_payments", () => {
  it("tiene las columnas de la spec (incluida currency)", () => {
    const c = cfg("fixedBillPayments");
    expect(c.name).toBe("fixed_bill_payments");
    expect(col(c, "bill_id").notNull).toBe(true);
    expect(col(c, "period").notNull).toBe(true);
    expect(col(c, "period").columnType).toMatch(/Date/);
    expect(col(c, "amount_cents").columnType).toMatch(/BigInt/i);
    expect(col(c, "currency").notNull).toBe(true);
    expect(col(c, "paid_on").notNull).toBe(true);
    expect(col(c, "expense_id").notNull).toBe(false);
    expect(col(c, "created_expense").default).toBe(false);
    col(c, "created_at");
  });

  it("CA15: bill_id -> fixed_bills ON DELETE CASCADE", () => {
    const { fk, ref } = fkOn(cfg("fixedBillPayments"), "bill_id");
    expect(getTableConfig(ref.foreignTable).name).toBe("fixed_bills");
    expect(fk.onDelete).toBe("cascade");
  });

  it("CA14: expense_id -> expenses ON DELETE SET NULL", () => {
    const { fk, ref } = fkOn(cfg("fixedBillPayments"), "expense_id");
    expect(getTableConfig(ref.foreignTable).name).toBe("expenses");
    expect(fk.onDelete).toBe("set null");
  });

  it("CA11: UNIQUE(bill_id, period) llamado fixed_bill_payments_bill_period_idx", () => {
    const c = cfg("fixedBillPayments");
    const idx = c.indexes.find((i) => i.config.name === "fixed_bill_payments_bill_period_idx");
    expect(idx).toBeDefined();
    expect(idx!.config.unique).toBe(true);
    expect(idx!.config.columns.map((x: any) => x.name)).toEqual(["bill_id", "period"]);
  });

  it("CA12: UNIQUE(expense_id) parcial llamado fixed_bill_payments_expense_idx", () => {
    const c = cfg("fixedBillPayments");
    const idx = c.indexes.find((i) => i.config.name === "fixed_bill_payments_expense_idx");
    expect(idx).toBeDefined();
    expect(idx!.config.unique).toBe(true);
    expect(idx!.config.columns.map((x: any) => x.name)).toEqual(["expense_id"]);
    expect(idx!.config.where, "el índice tiene que ser parcial (where expense_id is not null)").toBeDefined();
  });
});
