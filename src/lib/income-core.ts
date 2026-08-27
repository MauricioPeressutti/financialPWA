import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { incomes, subcategories } from "@/db/schema";
import type { IncomeMethod } from "@/lib/income-methods";

export type NewIncome = {
  amountCents: number;
  categoryId: string;
  subcategoryId?: string | null;
  method: IncomeMethod;
  description?: string | null;
  receivedOn: string; // YYYY-MM-DD
};

/**
 * Inserta un ingreso. Sin auth ni revalidatePath — el llamador (Server Action
 * o webhook) se encarga de eso.
 */
export async function insertIncome(
  teamId: string,
  userId: string,
  e: NewIncome,
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
    .insert(incomes)
    .values({
      teamId,
      createdByUserId: userId,
      amountCents: e.amountCents,
      categoryId: e.categoryId,
      subcategoryId: subId,
      method: e.method,
      description: e.description || null,
      receivedOn: e.receivedOn,
    })
    .returning({ id: incomes.id });

  return created;
}
