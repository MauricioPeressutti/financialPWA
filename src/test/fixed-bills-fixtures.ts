// Fixtures compartidas por los tests de gastos fijos (actions + queries).
import { randomUUID } from "node:crypto";

import * as schema from "@/db/schema";

import { fake } from "./fake-db";

/* eslint-disable @typescript-eslint/no-explicit-any */
const s = schema as Record<string, any>;

/** Tablas nuevas (undefined hasta que el builder las agregue al schema). */
export const T = {
  get fixedBills() {
    return s.fixedBills;
  },
  get fixedBillPayments() {
    return s.fixedBillPayments;
  },
  expenses: schema.expenses,
  categories: schema.categories,
};

export const TEAM1 = randomUUID();
export const TEAM2 = randomUUID();
export const USER_A = randomUUID();
export const USER_B = randomUUID();

export function team(id: string) {
  return {
    id,
    name: id === TEAM1 ? "Casa" : "Laburo",
    ownerUserId: USER_A,
    primaryCurrency: "ARS",
    currencies: ["ARS", "USD"],
    fxReference: "blue",
    effortEnabled: false,
    goalsEnabled: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    role: "owner" as const,
  };
}

export function user(id: string) {
  return {
    id,
    firebaseUid: `fb-${id}`,
    email: `${id}@test.local`,
    displayName: id === USER_A ? "Ana" : "Beto",
    photoUrl: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
}

export function session(userId: string, teamId: string) {
  return { user: user(userId), team: team(teamId) };
}

export function seedCategory(over: Record<string, unknown> = {}) {
  return fake.seed(T.categories, {
    teamId: TEAM1,
    name: "Servicios",
    kind: "expense",
    ...over,
  });
}

export function seedBill(over: Record<string, unknown> = {}) {
  return fake.seed(T.fixedBills, {
    teamId: TEAM1,
    userId: USER_A,
    name: "Teléfono",
    emoji: "📱",
    amountCents: 1_500_000,
    currency: "ARS",
    categoryId: null,
    paymentMethod: "credito",
    dueDay: 10,
    active: true,
    createdAt: new Date("2026-10-15T15:00:00Z"),
    ...over,
  });
}

export function seedPayment(billId: unknown, over: Record<string, unknown> = {}) {
  return fake.seed(T.fixedBillPayments, {
    billId,
    period: "2026-11-01",
    amountCents: 1_500_000,
    currency: "ARS",
    paidOn: "2026-11-05",
    expenseId: null,
    createdExpense: false,
    ...over,
  });
}

export function seedExpense(over: Record<string, unknown> = {}) {
  return fake.seed(T.expenses, {
    teamId: TEAM1,
    createdByUserId: USER_A,
    amountCents: 1_590_000,
    currency: "ARS",
    categoryId: randomUUID(),
    paymentMethod: "debito",
    description: "Movistar",
    spentOn: "2026-11-08",
    ...over,
  });
}
