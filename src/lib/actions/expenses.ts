"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { expenses, reimbursements } from "@/db/schema";
import { requireTeam } from "@/lib/auth";
import { insertExpense } from "@/lib/expenses-core";
import { fxForMovement } from "@/lib/fx";
import { parseAmountToCents } from "@/lib/money";
import { expenseInput, reimbursementInput } from "@/lib/validation";

type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/");
  revalidatePath("/movimientos");
  revalidatePath("/analytics");
}

export async function createExpense(raw: unknown): Promise<ActionResult> {
  const { user, team } = await requireTeam();
  const parsed = expenseInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const cents = parseAmountToCents(parsed.data.amount);
  if (cents === null || cents === 0) return { ok: false, error: "Monto inválido" };

  const fx = await fxForMovement(team, parsed.data.currency, parsed.data.fxRate);
  if (fx.error) return { ok: false, error: fx.error };

  const refundCents = parsed.data.reimbursedAmount
    ? parseAmountToCents(parsed.data.reimbursedAmount)
    : null;

  await insertExpense(team.id, user.id, {
    amountCents: cents,
    currency: parsed.data.currency,
    fxRate: fx.fxRate,
    categoryId: parsed.data.categoryId,
    subcategoryId: parsed.data.subcategoryId || null,
    paymentMethod: parsed.data.paymentMethod,
    description: parsed.data.description || null,
    spentOn: parsed.data.spentOn,
    reimbursedCents: refundCents,
  });

  revalidate();
  return { ok: true };
}

export async function updateExpense(id: string, raw: unknown): Promise<ActionResult> {
  const { team } = await requireTeam();
  const parsed = expenseInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const cents = parseAmountToCents(parsed.data.amount);
  if (cents === null || cents === 0) return { ok: false, error: "Monto inválido" };

  const fx = await fxForMovement(team, parsed.data.currency, parsed.data.fxRate);
  if (fx.error) return { ok: false, error: fx.error };

  const updated = await db
    .update(expenses)
    .set({
      amountCents: cents,
      currency: parsed.data.currency,
      fxRate: fx.fxRate,
      baseAmountCents: Math.round(cents * fx.fxRate),
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

  revalidate();
  revalidatePath(`/expenses/${id}`);
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const { team } = await requireTeam();
  await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.teamId, team.id)));
  revalidate();
  return { ok: true };
}

export async function addReimbursement(raw: unknown): Promise<ActionResult> {
  const { team } = await requireTeam();
  const parsed = reimbursementInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const cents = parseAmountToCents(parsed.data.amount);
  if (cents === null || cents === 0) return { ok: false, error: "Monto inválido" };

  const [expense] = await db
    .select({
      id: expenses.id,
      currency: expenses.currency,
      fxRate: expenses.fxRate,
    })
    .from(expenses)
    .where(and(eq(expenses.id, parsed.data.expenseId), eq(expenses.teamId, team.id)))
    .limit(1);
  if (!expense) return { ok: false, error: "Gasto no encontrado" };

  await db.insert(reimbursements).values({
    expenseId: parsed.data.expenseId,
    teamId: team.id,
    amountCents: cents,
    currency: expense.currency,
    fxRate: expense.fxRate,
    baseAmountCents: Math.round(cents * expense.fxRate),
    note: parsed.data.note || null,
    reimbursedOn: parsed.data.reimbursedOn,
  });

  revalidate();
  revalidatePath(`/expenses/${parsed.data.expenseId}`);
  return { ok: true };
}

export async function deleteReimbursement(id: string): Promise<ActionResult> {
  const { team } = await requireTeam();
  await db
    .delete(reimbursements)
    .where(and(eq(reimbursements.id, id), eq(reimbursements.teamId, team.id)));
  revalidate();
  return { ok: true };
}
