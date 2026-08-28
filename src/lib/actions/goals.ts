"use server";

import { revalidatePath } from "next/cache";
import { and, eq, or } from "drizzle-orm";

import { db } from "@/db";
import { goalContributions, goals } from "@/db/schema";
import { requireTeam } from "@/lib/auth";
import { isCurrency } from "@/lib/currencies";
import { recomputeGoalStatus } from "@/lib/goals";
import { parseAmountToCents } from "@/lib/money";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function revalidate(id?: string) {
  revalidatePath("/objetivos");
  revalidatePath("/");
  if (id) revalidatePath(`/objetivos/${id}`);
}

export async function createGoal(input: {
  name: string;
  emoji: string;
  targetAmount: string;
  currency: string;
  scope: string;
  targetDate: string;
}): Promise<ActionResult<{ id: string }>> {
  const { user, team } = await requireTeam();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Poné un nombre" };
  const cents = parseAmountToCents(input.targetAmount);
  if (cents === null || cents <= 0)
    return { ok: false, error: "Monto meta inválido" };
  const currency = isCurrency(input.currency) ? input.currency : "ARS";
  const scope = input.scope === "personal" ? "personal" : "shared";

  const [g] = await db
    .insert(goals)
    .values({
      teamId: team.id,
      name,
      emoji: input.emoji || "🎯",
      targetCents: cents,
      currency,
      scope,
      ownerUserId: scope === "personal" ? user.id : null,
      targetDate: DATE_RE.test(input.targetDate) ? input.targetDate : null,
      createdByUserId: user.id,
    })
    .returning({ id: goals.id });

  revalidate();
  return { ok: true, id: g.id };
}

export async function updateGoal(
  id: string,
  input: {
    name: string;
    emoji: string;
    targetAmount: string;
    currency: string;
    targetDate: string;
  },
): Promise<ActionResult> {
  const { user, team } = await requireTeam();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Poné un nombre" };
  const cents = parseAmountToCents(input.targetAmount);
  if (cents === null || cents <= 0)
    return { ok: false, error: "Monto meta inválido" };

  const updated = await db
    .update(goals)
    .set({
      name,
      emoji: input.emoji || "🎯",
      targetCents: cents,
      currency: isCurrency(input.currency) ? input.currency : "ARS",
      targetDate: DATE_RE.test(input.targetDate) ? input.targetDate : null,
    })
    .where(
      and(
        eq(goals.id, id),
        eq(goals.teamId, team.id),
        or(eq(goals.scope, "shared"), eq(goals.ownerUserId, user.id)),
      ),
    )
    .returning({ id: goals.id });
  if (updated.length === 0) return { ok: false, error: "Objetivo no encontrado" };

  await recomputeGoalStatus(id);
  revalidate(id);
  return { ok: true };
}

export async function setGoalArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const { user, team } = await requireTeam();
  await db
    .update(goals)
    .set({ status: archived ? "archived" : "active" })
    .where(
      and(
        eq(goals.id, id),
        eq(goals.teamId, team.id),
        or(eq(goals.scope, "shared"), eq(goals.ownerUserId, user.id)),
      ),
    );
  if (!archived) await recomputeGoalStatus(id);
  revalidate(id);
  return { ok: true };
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  const { user, team } = await requireTeam();
  await db
    .delete(goals)
    .where(
      and(
        eq(goals.id, id),
        eq(goals.teamId, team.id),
        or(eq(goals.scope, "shared"), eq(goals.ownerUserId, user.id)),
      ),
    );
  revalidate();
  return { ok: true };
}

export async function addContribution(input: {
  goalId: string;
  amount: string;
  note?: string;
  contributedOn: string;
}): Promise<ActionResult> {
  const { user, team } = await requireTeam();
  const cents = parseAmountToCents(input.amount);
  if (cents === null || cents <= 0) return { ok: false, error: "Monto inválido" };

  const [g] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(
      and(
        eq(goals.id, input.goalId),
        eq(goals.teamId, team.id),
        or(eq(goals.scope, "shared"), eq(goals.ownerUserId, user.id)),
      ),
    )
    .limit(1);
  if (!g) return { ok: false, error: "Objetivo no encontrado" };

  await db.insert(goalContributions).values({
    goalId: input.goalId,
    userId: user.id,
    amountCents: cents,
    note: input.note?.trim() || null,
    contributedOn: DATE_RE.test(input.contributedOn)
      ? input.contributedOn
      : new Date().toISOString().slice(0, 10),
  });

  await recomputeGoalStatus(input.goalId);
  revalidate(input.goalId);
  return { ok: true };
}

export async function deleteContribution(
  id: string,
  goalId: string,
): Promise<ActionResult> {
  const { team } = await requireTeam();
  // solo si el objetivo es del equipo
  const [g] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.teamId, team.id)))
    .limit(1);
  if (!g) return { ok: false, error: "No encontrado" };

  await db.delete(goalContributions).where(eq(goalContributions.id, id));
  await recomputeGoalStatus(goalId);
  revalidate(goalId);
  return { ok: true };
}
