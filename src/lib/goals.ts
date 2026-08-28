import "server-only";

import { and, desc, eq, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { goalContributions, goals, users } from "@/db/schema";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function goalProgress(targetCents: number, savedCents: number) {
  const pct = targetCents > 0 ? (savedCents / targetCents) * 100 : 0;
  return {
    pct,
    remainingCents: Math.max(0, targetCents - savedCents),
    reached: savedCents >= targetCents,
  };
}

/** Objetivos visibles para el usuario: compartidos del equipo + personales suyos. */
export async function getGoalsForUser(teamId: string, userId: string) {
  const visible = and(
    eq(goals.teamId, teamId),
    or(eq(goals.scope, "shared"), eq(goals.ownerUserId, userId)),
  );

  const rows = await db
    .select({
      id: goals.id,
      name: goals.name,
      emoji: goals.emoji,
      targetCents: goals.targetCents,
      currency: goals.currency,
      scope: goals.scope,
      status: goals.status,
      targetDate: goals.targetDate,
      savedCents: sql<number>`coalesce((
        select sum(c.amount_cents) from goal_contributions c where c.goal_id = ${goals.id}
      ), 0)`,
      contribCount: sql<number>`(
        select count(*) from goal_contributions c where c.goal_id = ${goals.id}
      )`,
    })
    .from(goals)
    .where(visible)
    .orderBy(desc(goals.createdAt));

  return rows.map((g) => ({
    ...g,
    savedCents: Number(g.savedCents),
    contribCount: Number(g.contribCount),
    ...goalProgress(g.targetCents, Number(g.savedCents)),
  }));
}

export async function getGoal(teamId: string, id: string, userId: string) {
  const [g] = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.id, id),
        eq(goals.teamId, teamId),
        or(eq(goals.scope, "shared"), eq(goals.ownerUserId, userId)),
      ),
    )
    .limit(1);
  if (!g) return null;

  const contribs = await db
    .select({
      id: goalContributions.id,
      amountCents: goalContributions.amountCents,
      note: goalContributions.note,
      contributedOn: goalContributions.contributedOn,
      byName: users.displayName,
      byEmail: users.email,
      userId: goalContributions.userId,
    })
    .from(goalContributions)
    .innerJoin(users, eq(users.id, goalContributions.userId))
    .where(eq(goalContributions.goalId, id))
    .orderBy(desc(goalContributions.contributedOn), desc(goalContributions.createdAt));

  const savedCents = contribs.reduce((a, c) => a + c.amountCents, 0);
  const prog = goalProgress(g.targetCents, savedCents);

  // ritmo: promedio mensual de los últimos 90 días
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const recent = contribs.filter((c) => String(c.contributedOn) >= iso(since));
  const recentSum = recent.reduce((a, c) => a + c.amountCents, 0);
  const monthlyRateCents = Math.round(recentSum / 3);
  const monthsLeft =
    monthlyRateCents > 0
      ? Math.ceil(prog.remainingCents / monthlyRateCents)
      : null;
  const eta =
    monthsLeft != null
      ? (() => {
          const d = new Date();
          d.setDate(1);
          d.setMonth(d.getMonth() + monthsLeft);
          return d;
        })()
      : null;

  // ¿llega tarde vs la fecha meta?
  let onTrack: boolean | null = null;
  let neededPerMonthCents: number | null = null;
  if (g.targetDate && !prog.reached) {
    const t = new Date(String(g.targetDate) + "T00:00:00");
    const now = new Date();
    const monthsToTarget = Math.max(
      1,
      (t.getFullYear() - now.getFullYear()) * 12 + (t.getMonth() - now.getMonth()),
    );
    neededPerMonthCents = Math.ceil(prog.remainingCents / monthsToTarget);
    onTrack = eta ? eta <= t : false;
  }

  return {
    goal: {
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      targetCents: g.targetCents,
      currency: g.currency,
      scope: g.scope,
      status: g.status,
      targetDate: g.targetDate ? String(g.targetDate) : null,
      ownerUserId: g.ownerUserId,
    },
    contribs: contribs.map((c) => ({
      id: c.id,
      amountCents: c.amountCents,
      note: c.note,
      contributedOn: String(c.contributedOn),
      by: c.byName ?? c.byEmail,
    })),
    savedCents,
    ...prog,
    monthlyRateCents,
    monthsLeft,
    etaLabel: eta
      ? eta.toLocaleDateString("es-AR", { month: "short", year: "numeric" })
      : null,
    onTrack,
    neededPerMonthCents,
  };
}

export type GoalDetail = NonNullable<Awaited<ReturnType<typeof getGoal>>>;

/** Recalcula el status de un objetivo (active <-> reached), sin tocar archived. */
export async function recomputeGoalStatus(goalId: string) {
  const [g] = await db
    .select({
      target: goals.targetCents,
      status: goals.status,
      saved: sql<number>`coalesce((
        select sum(c.amount_cents) from goal_contributions c where c.goal_id = ${goals.id}
      ), 0)`,
    })
    .from(goals)
    .where(eq(goals.id, goalId))
    .limit(1);
  if (!g || g.status === "archived") return;
  const reached = Number(g.saved) >= g.target;
  const next = reached ? "reached" : "active";
  if (next !== g.status) {
    await db.update(goals).set({ status: next }).where(eq(goals.id, goalId));
  }
}

/** Objetivo activo más cercano a cumplirse (para la tarjeta de Inicio). */
export async function getTopGoal(teamId: string, userId: string) {
  const all = await getGoalsForUser(teamId, userId);
  const active = all.filter((g) => g.status === "active");
  if (active.length === 0) return null;
  return active.sort((a, b) => b.pct - a.pct)[0];
}
