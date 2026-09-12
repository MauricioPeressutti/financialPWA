"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { expenseSplits, expenses, reimbursements, teamMembers } from "@/db/schema";
import { requireTeam } from "@/lib/auth";
import { splitShares, type SplitMode } from "@/lib/effort";
import { normalizeEntity } from "@/lib/entities";
import { insertExpense } from "@/lib/expenses-core";
import { fxForMovement } from "@/lib/fx";
import { parseAmountToCents } from "@/lib/money";
import { expenseInput, reimbursementInput } from "@/lib/validation";

type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/");
  revalidatePath("/movimientos");
  revalidatePath("/analytics");
  revalidatePath("/esfuerzo");
}

/** Calcula el reparto de un gasto compartido con los ingresos actuales del equipo. */
async function resolveSplits(
  teamId: string,
  amountCents: number,
  splitMode: SplitMode | "none",
  paidByUserId: string,
  splitCustomJson: string,
): Promise<
  | { ok: true; splits: { userId: string; owedCents: number }[]; paidBy: string | null }
  | { ok: false; error: string }
> {
  if (splitMode === "none")
    return { ok: true, splits: [], paidBy: null };

  const members = await db
    .select({
      userId: teamMembers.userId,
      incomeCents: teamMembers.declaredIncomeCents,
    })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));

  if (members.length < 2)
    return { ok: false, error: "El equipo necesita 2 personas para repartir." };
  if (!members.some((m) => m.userId === paidByUserId))
    return { ok: false, error: "Elegí quién pagó el gasto." };

  let custom: Record<string, number> | undefined;
  if (splitMode === "custom" && splitCustomJson) {
    try {
      custom = JSON.parse(splitCustomJson) as Record<string, number>;
    } catch {
      custom = undefined;
    }
  }

  return {
    ok: true,
    splits: splitShares(amountCents, splitMode as SplitMode, members, custom),
    paidBy: paidByUserId,
  };
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

  const split = await resolveSplits(
    team.id,
    cents,
    parsed.data.splitMode,
    parsed.data.paidByUserId || "",
    parsed.data.splitCustom || "",
  );
  if (!split.ok) return { ok: false, error: split.error };

  await insertExpense(team.id, user.id, {
    amountCents: cents,
    currency: parsed.data.currency,
    fxRate: fx.fxRate,
    categoryId: parsed.data.categoryId,
    subcategoryId: parsed.data.subcategoryId || null,
    paymentMethod: parsed.data.paymentMethod,
    entity: parsed.data.entity || null,
    description: parsed.data.description || null,
    spentOn: parsed.data.spentOn,
    reimbursedCents: refundCents,
    splitMode: parsed.data.splitMode,
    paidByUserId: split.paidBy,
    splits: split.splits,
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

  const split = await resolveSplits(
    team.id,
    cents,
    parsed.data.splitMode,
    parsed.data.paidByUserId || "",
    parsed.data.splitCustom || "",
  );
  if (!split.ok) return { ok: false, error: split.error };

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
      entity: normalizeEntity(parsed.data.entity),
      description: parsed.data.description || null,
      spentOn: parsed.data.spentOn,
      splitMode: parsed.data.splitMode,
      paidByUserId: split.paidBy,
      updatedAt: new Date(),
    })
    .where(and(eq(expenses.id, id), eq(expenses.teamId, team.id)))
    .returning({ id: expenses.id });

  if (updated.length === 0) return { ok: false, error: "Gasto no encontrado" };

  await db.delete(expenseSplits).where(eq(expenseSplits.expenseId, id));
  if (split.splits.length > 0) {
    await db.insert(expenseSplits).values(
      split.splits.map((s) => ({
        expenseId: id,
        userId: s.userId,
        owedCents: s.owedCents,
      })),
    );
  }

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
