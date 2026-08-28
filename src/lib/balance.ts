import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  expenseSplits,
  expenses,
  settlements,
  teamMembers,
  users,
} from "@/db/schema";

/** Saldo entre las personas del equipo por gastos compartidos, en una moneda. */
export async function getTeamBalance(teamId: string, currency: string) {
  const [memberRows, sharedRows, splitRows, settleRows] = await Promise.all([
    db
      .select({
        userId: users.id,
        name: users.displayName,
        email: users.email,
      })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(eq(teamMembers.teamId, teamId))
      .orderBy(teamMembers.createdAt),
    db
      .select({
        id: expenses.id,
        amountCents: expenses.amountCents,
        paidBy: expenses.paidByUserId,
        spentOn: expenses.spentOn,
        splitMode: expenses.splitMode,
        categoryName: categories.name,
      })
      .from(expenses)
      .innerJoin(categories, eq(categories.id, expenses.categoryId))
      .where(
        and(
          eq(expenses.teamId, teamId),
          eq(expenses.currency, currency),
          ne(expenses.splitMode, "none"),
        ),
      )
      .orderBy(desc(expenses.spentOn)),
    db
      .select({
        expenseId: expenseSplits.expenseId,
        userId: expenseSplits.userId,
        owedCents: expenseSplits.owedCents,
      })
      .from(expenseSplits)
      .innerJoin(expenses, eq(expenses.id, expenseSplits.expenseId))
      .where(
        and(
          eq(expenses.teamId, teamId),
          eq(expenses.currency, currency),
        ),
      ),
    db
      .select()
      .from(settlements)
      .where(
        and(
          eq(settlements.teamId, teamId),
          eq(settlements.currency, currency),
        ),
      )
      .orderBy(desc(settlements.settledOn)),
  ]);

  const nameOf = new Map(
    memberRows.map((m) => [m.userId, m.name ?? m.email]),
  );

  // net[user] > 0 => le deben ; < 0 => debe
  const net: Record<string, number> = {};
  for (const m of memberRows) net[m.userId] = 0;

  const splitsByExpense = new Map<string, { userId: string; owedCents: number }[]>();
  for (const s of splitRows) {
    const arr = splitsByExpense.get(s.expenseId) ?? [];
    arr.push({ userId: s.userId, owedCents: s.owedCents });
    splitsByExpense.set(s.expenseId, arr);
    if (net[s.userId] === undefined) net[s.userId] = 0;
    net[s.userId] -= s.owedCents;
  }
  for (const e of sharedRows) {
    if (e.paidBy) {
      if (net[e.paidBy] === undefined) net[e.paidBy] = 0;
      net[e.paidBy] += e.amountCents;
    }
  }
  for (const st of settleRows) {
    net[st.fromUserId] = (net[st.fromUserId] ?? 0) + st.amountCents;
    net[st.toUserId] = (net[st.toUserId] ?? 0) - st.amountCents;
  }

  const balances = memberRows.map((m) => ({
    userId: m.userId,
    name: m.name ?? m.email,
    netCents: net[m.userId] ?? 0,
  }));

  // sugerencia de pago (ideal para 2 personas)
  const creditor = balances.reduce((a, b) => (b.netCents > a.netCents ? b : a));
  const debtor = balances.reduce((a, b) => (b.netCents < a.netCents ? b : a));
  const settleAmount = Math.min(creditor.netCents, -debtor.netCents);
  const suggestion =
    settleAmount > 0
      ? {
          fromUserId: debtor.userId,
          fromName: debtor.name,
          toUserId: creditor.userId,
          toName: creditor.name,
          amountCents: settleAmount,
        }
      : null;

  // detalle por gasto (cuánto movió el saldo del acreedor sugerido)
  const perExpense = sharedRows.map((e) => {
    const splits = splitsByExpense.get(e.id) ?? [];
    const payerShare = splits.find((s) => s.userId === e.paidBy)?.owedCents ?? 0;
    const othersOwe = e.amountCents - payerShare;
    return {
      id: e.id,
      label: e.categoryName,
      spentOn: String(e.spentOn),
      amountCents: e.amountCents,
      paidByName: e.paidBy ? (nameOf.get(e.paidBy) ?? "—") : "—",
      othersOweCents: othersOwe,
      splitMode: e.splitMode as string,
    };
  });

  return {
    currency,
    balances,
    suggestion,
    perExpense,
    settlements: settleRows.map((s) => ({
      id: s.id,
      fromName: nameOf.get(s.fromUserId) ?? "—",
      toName: nameOf.get(s.toUserId) ?? "—",
      amountCents: s.amountCents,
      settledOn: String(s.settledOn),
      note: s.note,
    })),
    hasShared: sharedRows.length > 0 || settleRows.length > 0,
  };
}

export type TeamBalance = Awaited<ReturnType<typeof getTeamBalance>>;
