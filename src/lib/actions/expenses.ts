"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { expenses, reimbursements, subcategories } from "@/db/schema";
import { requireTeam } from "@/lib/auth";
import { parseAmountToCents } from "@/lib/money";
import { expenseInput, reimbursementInput } from "@/lib/validation";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function createExpense(raw: unknown): Promise<ActionResult> {
  const { user, team } = await requireTeam();
  const parsed = expenseInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const cents = parseAmountToCents(parsed.data.amount);
  if (cents === null || cents === 0) return { ok: false, error: "Monto inválido" };

  const subId = parsed.data.subcategoryId || null;
  if (subId) {
    const [sub] = await db
      .select({ id: subcategories.id })
      .from(subcategories)
      .where(and(eq(subcategories.id, subId), eq(subcategories.teamId, team.id)))
      .limit(1);
    if (!sub) return { ok: false, error: "Subcategoría inválida" };
  }

  const [created] = await db
    .insert(expenses)
    .values({
      teamId: team.id,
      createdByUserId: user.id,
      amountCents: cents,
      categoryId: parsed.data.categoryId,
      subcategoryId: subId,
      paymentMethod: parsed.data.paymentMethod,
      description: parsed.data.description || null,
      spentOn: parsed.data.spentOn,
    })
    .returning({ id: expenses.id });

  // Reintegro inmediato (opcional) — mismo día que el gasto.
  const refundCents = parsed.data.reimbursedAmount
    ? parseAmountToCents(parsed.data.reimbursedAmount)
    : null;
  if (refundCents !== null && refundCents > 0) {
    await db.insert(reimbursements).values({
      expenseId: created.id,
      teamId: team.id,
      amountCents: refundCents,
      note: "Reintegro al cargar el gasto",
      reimbursedOn: parsed.data.spentOn,
    });
  }

  revalidatePath("/");
  revalidatePath("/expenses");
  return { ok: true };
}

export async function updateExpense(id: string, raw: unknown): Promise<ActionResult> {
  const { team } = await requireTeam();
  const parsed = expenseInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const cents = parseAmountToCents(parsed.data.amount);
  if (cents === null || cents === 0) return { ok: false, error: "Monto inválido" };

  const updated = await db
    .update(expenses)
    .set({
      amountCents: cents,
      categoryId: parsed.data.categoryId,
      subcategoryId: parsed.data.subcategoryId || null,
      paymentMethod: parsed.data.paymentMethod,
      description: parsed.data.description || null,
      spentOn: parsed.data.spentOn,
      updatedAt: new Date(),
    })
    .where(and(eq(expenses.id, id), eq(expenses.teamId, team.id)))
    .returning({ id: expenses.id });

  if (updated.length === 0) return { ok: false, error: "Gasto no encontrado" };

  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const { team } = await requireTeam();
  await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.teamId, team.id)));
  revalidatePath("/");
  revalidatePath("/expenses");
  return { ok: true };
}

export async function addReimbursement(raw: unknown): Promise<ActionResult> {
  const { team } = await requireTeam();
  const parsed = reimbursementInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const cents = parseAmountToCents(parsed.data.amount);
  if (cents === null || cents === 0) return { ok: false, error: "Monto inválido" };

  const [expense] = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(and(eq(expenses.id, parsed.data.expenseId), eq(expenses.teamId, team.id)))
    .limit(1);
  if (!expense) return { ok: false, error: "Gasto no encontrado" };

  await db.insert(reimbursements).values({
    expenseId: parsed.data.expenseId,
    teamId: team.id,
    amountCents: cents,
    note: parsed.data.note || null,
    reimbursedOn: parsed.data.reimbursedOn,
  });

  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${parsed.data.expenseId}`);
  return { ok: true };
}

export async function deleteReimbursement(id: string): Promise<ActionResult> {
  const { team } = await requireTeam();
  await db
    .delete(reimbursements)
    .where(and(eq(reimbursements.id, id), eq(reimbursements.teamId, team.id)));
  revalidatePath("/");
  revalidatePath("/expenses");
  return { ok: true };
}
