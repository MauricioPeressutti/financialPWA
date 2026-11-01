import "server-only";

import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import { categories, expenses, fixedBillPayments, fixedBills } from "@/db/schema";
import {
  billAppliesTo,
  candidateWindow,
  rankLinkCandidates,
  type CandidateExpense,
  type FixedBillLike,
  type FixedBillPaymentLike,
  type RankedCandidate,
} from "@/lib/fixed-bills";

export type FixedBillMonthRow = {
  bill: FixedBillLike & {
    teamId: string;
    userId: string;
    emoji: string;
    paymentMethod: string;
  };
  payment: (FixedBillPaymentLike & { id: string }) | null;
};

export type WindowExpense = CandidateExpense & { linked: boolean };

/** Fijos de (teamId, userId) que aplican al período, con su pago del período (o null). */
export async function listFixedBillsForMonth(
  teamId: string,
  userId: string,
  period: string,
): Promise<FixedBillMonthRow[]> {
  const rows = await db
    .select({ bill: fixedBills, payment: fixedBillPayments })
    .from(fixedBills)
    .leftJoin(
      fixedBillPayments,
      and(
        eq(fixedBillPayments.billId, fixedBills.id),
        eq(fixedBillPayments.period, period),
      ),
    )
    .where(and(eq(fixedBills.teamId, teamId), eq(fixedBills.userId, userId)))
    .orderBy(fixedBills.createdAt);

  return rows
    .filter((r) => billAppliesTo(r.bill, period, r.payment))
    .map((r) => ({ bill: r.bill, payment: r.payment }));
}

/** Todos los fijos de (teamId, userId), activos y archivados. */
export async function listUserFixedBills(teamId: string, userId: string) {
  return db
    .select()
    .from(fixedBills)
    .where(and(eq(fixedBills.teamId, teamId), eq(fixedBills.userId, userId)))
    .orderBy(fixedBills.name);
}

/** id -> nombre de todas las categorías del equipo (incluidas las archivadas). */
export async function getCategoryNames(teamId: string): Promise<Record<string, string>> {
  const rows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.teamId, teamId));
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

/**
 * Gastos del equipo dentro de candidateWindow(period), marcando los que ya
 * están vinculados a algún pago. Sirve para rankear candidatas de varios
 * fijos con una sola consulta.
 */
export async function listWindowExpenses(
  teamId: string,
  period: string,
): Promise<WindowExpense[]> {
  const { from, to } = candidateWindow(period);
  const rows = await db
    .select({
      id: expenses.id,
      amountCents: expenses.amountCents,
      currency: expenses.currency,
      categoryId: expenses.categoryId,
      description: expenses.description,
      entity: expenses.entity,
      spentOn: expenses.spentOn,
      paymentId: fixedBillPayments.id,
    })
    .from(expenses)
    .leftJoin(fixedBillPayments, eq(fixedBillPayments.expenseId, expenses.id))
    .where(
      and(
        eq(expenses.teamId, teamId),
        gte(expenses.spentOn, from),
        lte(expenses.spentOn, to),
      ),
    );

  return rows.map(({ paymentId, ...e }) => ({ ...e, linked: paymentId != null }));
}

/**
 * Gastos candidatos para vincular al fijo `billId` (que debe ser de teamId+userId;
 * si no, devuelve []). Solo gastos de teamId, dentro de candidateWindow(period)
 * y sin vínculo previo, ordenados con rankLinkCandidates.
 */
export async function listLinkCandidates(
  teamId: string,
  userId: string,
  billId: string,
  period: string,
): Promise<RankedCandidate[]> {
  const [bill] = await db
    .select()
    .from(fixedBills)
    .where(
      and(
        eq(fixedBills.id, billId),
        eq(fixedBills.teamId, teamId),
        eq(fixedBills.userId, userId),
      ),
    )
    .limit(1);
  if (!bill) return [];

  const window = await listWindowExpenses(teamId, period);
  return rankLinkCandidates(bill, period, window);
}
