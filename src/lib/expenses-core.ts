import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  expenseSplits,
  expenses,
  reimbursements,
  subcategories,
} from "@/db/schema";
import { parseAmountToCents } from "@/lib/money";
import type { PaymentMethod } from "@/lib/payment-methods";
import type { SplitMode } from "@/lib/effort";

export type NewExpense = {
  amountCents: number;
  currency?: string; // default "ARS"
  fxRate?: number; // 1 currency = fxRate moneda principal (default 1)
  categoryId: string;
  subcategoryId?: string | null;
  paymentMethod: PaymentMethod;
  description?: string | null;
  spentOn: string; // YYYY-MM-DD
  reimbursedCents?: number | null; // en la misma moneda que el gasto
  statementId?: string | null; // importado desde un resumen de tarjeta
  // Calculadora de esfuerzo
  splitMode?: SplitMode | "none";
  paidByUserId?: string | null;
  splits?: { userId: string; owedCents: number }[];
};

/**
 * Inserta un gasto (y su reintegro inmediato si corresponde). Sin auth ni
 * revalidatePath — el llamador (Server Action o webhook) se encarga de eso.
 */
export async function insertExpense(
  teamId: string,
  userId: string,
  e: NewExpense,
): Promise<{ id: string }> {
  let subId = e.subcategoryId || null;
  if (subId) {
    const [sub] = await db
      .select({ id: subcategories.id })
      .from(subcategories)
      .where(and(eq(subcategories.id, subId), eq(subcategories.teamId, teamId)))
      .limit(1);
    if (!sub) subId = null;
  }

  const currency = e.currency || "ARS";
  const fxRate = e.fxRate && e.fxRate > 0 ? e.fxRate : 1;
  const baseAmountCents = Math.round(e.amountCents * fxRate);

  const splitMode = e.splitMode && e.splitMode !== "none" ? e.splitMode : "none";

  const [created] = await db
    .insert(expenses)
    .values({
      teamId,
      createdByUserId: userId,
      amountCents: e.amountCents,
      currency,
      fxRate,
      baseAmountCents,
      categoryId: e.categoryId,
      subcategoryId: subId,
      paymentMethod: e.paymentMethod,
      description: e.description || null,
      spentOn: e.spentOn,
      statementId: e.statementId ?? null,
      splitMode,
      paidByUserId: splitMode !== "none" ? e.paidByUserId || null : null,
    })
    .returning({ id: expenses.id });

  if (splitMode !== "none" && e.splits && e.splits.length > 0) {
    await db.insert(expenseSplits).values(
      e.splits.map((s) => ({
        expenseId: created.id,
        userId: s.userId,
        owedCents: s.owedCents,
      })),
    );
  }

  if (e.reimbursedCents && e.reimbursedCents > 0) {
    await db.insert(reimbursements).values({
      expenseId: created.id,
      teamId,
      amountCents: e.reimbursedCents,
      currency,
      fxRate,
      baseAmountCents: Math.round(e.reimbursedCents * fxRate),
      note: "Reintegro al cargar el gasto",
      reimbursedOn: e.spentOn,
    });
  }

  return created;
}

export { parseAmountToCents };
