import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { expenses, reimbursements, subcategories } from "@/db/schema";
import { parseAmountToCents } from "@/lib/money";
import type { PaymentMethod } from "@/lib/payment-methods";

export type NewExpense = {
  amountCents: number;
  categoryId: string;
  subcategoryId?: string | null;
  paymentMethod: PaymentMethod;
  description?: string | null;
  spentOn: string; // YYYY-MM-DD
  reimbursedCents?: number | null;
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

  const [created] = await db
    .insert(expenses)
    .values({
      teamId,
      createdByUserId: userId,
      amountCents: e.amountCents,
      categoryId: e.categoryId,
      subcategoryId: subId,
      paymentMethod: e.paymentMethod,
      description: e.description || null,
      spentOn: e.spentOn,
    })
    .returning({ id: expenses.id });

  if (e.reimbursedCents && e.reimbursedCents > 0) {
    await db.insert(reimbursements).values({
      expenseId: created.id,
      teamId,
      amountCents: e.reimbursedCents,
      note: "Reintegro al cargar el gasto",
      reimbursedOn: e.spentOn,
    });
  }

  return created;
}

export { parseAmountToCents };
