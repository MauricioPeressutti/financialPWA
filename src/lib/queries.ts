import "server-only";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  expenses,
  incomes,
  reimbursements,
  subcategories,
  teamInvitations,
  teamMembers,
  teams,
  telegramLinks,
  users,
} from "@/db/schema";
import type { CategoryKind } from "@/db/schema";
import type { PaymentMethod } from "@/lib/payment-methods";
import type { IncomeMethod } from "@/lib/income-methods";

/** Rango [primer día, último día] del mes YYYY-MM como strings de fecha. */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function getActiveCategories(
  teamId: string,
  kind: CategoryKind = "expense",
) {
  const cats = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.teamId, teamId),
        eq(categories.archived, false),
        eq(categories.kind, kind),
      ),
    )
    .orderBy(categories.name);
  const subs = await db
    .select()
    .from(subcategories)
    .where(and(eq(subcategories.teamId, teamId), eq(subcategories.archived, false)))
    .orderBy(subcategories.name);
  return cats.map((c) => ({
    ...c,
    subcategories: subs.filter((s) => s.categoryId === c.id),
  }));
}

export async function getAllCategories(teamId: string) {
  const cats = await db
    .select()
    .from(categories)
    .where(eq(categories.teamId, teamId))
    .orderBy(categories.name);
  const subs = await db
    .select()
    .from(subcategories)
    .where(eq(subcategories.teamId, teamId))
    .orderBy(subcategories.name);
  return cats.map((c) => ({
    ...c,
    subcategories: subs.filter((s) => s.categoryId === c.id),
  }));
}

export type ExpenseFilters = {
  month?: string;
  from?: string;
  to?: string;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
};

export async function listExpenses(teamId: string, filters: ExpenseFilters = {}) {
  const conds = [eq(expenses.teamId, teamId)];

  if (filters.month) {
    const { start, end } = monthRange(filters.month);
    conds.push(gte(expenses.spentOn, start), lte(expenses.spentOn, end));
  }
  if (filters.from) conds.push(gte(expenses.spentOn, filters.from));
  if (filters.to) conds.push(lte(expenses.spentOn, filters.to));
  if (filters.categoryId) conds.push(eq(expenses.categoryId, filters.categoryId));
  if (filters.paymentMethod) conds.push(eq(expenses.paymentMethod, filters.paymentMethod));

  const reimbSum = sql<number>`coalesce((
    select sum(${reimbursements.amountCents}) from ${reimbursements}
    where ${reimbursements.expenseId} = ${expenses.id}
  ), 0)`;
  const reimbBaseSum = sql<number>`coalesce((
    select sum(${reimbursements.baseAmountCents}) from ${reimbursements}
    where ${reimbursements.expenseId} = ${expenses.id}
  ), 0)`;

  return db
    .select({
      id: expenses.id,
      amountCents: expenses.amountCents,
      currency: expenses.currency,
      fxRate: expenses.fxRate,
      baseAmountCents: expenses.baseAmountCents,
      paymentMethod: expenses.paymentMethod,
      description: expenses.description,
      spentOn: expenses.spentOn,
      createdAt: expenses.createdAt,
      categoryName: categories.name,
      subcategoryName: subcategories.name,
      createdBy: users.displayName,
      reimbursedCents: reimbSum,
      reimbursedBaseCents: reimbBaseSum,
    })
    .from(expenses)
    .innerJoin(categories, eq(categories.id, expenses.categoryId))
    .leftJoin(subcategories, eq(subcategories.id, expenses.subcategoryId))
    .innerJoin(users, eq(users.id, expenses.createdByUserId))
    .where(and(...conds))
    .orderBy(desc(expenses.spentOn), desc(expenses.createdAt));
}

export async function getExpense(teamId: string, id: string) {
  const [expense] = await db
    .select({
      id: expenses.id,
      amountCents: expenses.amountCents,
      currency: expenses.currency,
      fxRate: expenses.fxRate,
      baseAmountCents: expenses.baseAmountCents,
      paymentMethod: expenses.paymentMethod,
      description: expenses.description,
      spentOn: expenses.spentOn,
      createdAt: expenses.createdAt,
      categoryId: expenses.categoryId,
      subcategoryId: expenses.subcategoryId,
      categoryName: categories.name,
      subcategoryName: subcategories.name,
      createdBy: users.displayName,
    })
    .from(expenses)
    .innerJoin(categories, eq(categories.id, expenses.categoryId))
    .leftJoin(subcategories, eq(subcategories.id, expenses.subcategoryId))
    .innerJoin(users, eq(users.id, expenses.createdByUserId))
    .where(and(eq(expenses.id, id), eq(expenses.teamId, teamId)))
    .limit(1);

  if (!expense) return null;

  const refunds = await db
    .select()
    .from(reimbursements)
    .where(eq(reimbursements.expenseId, id))
    .orderBy(desc(reimbursements.reimbursedOn));

  return { ...expense, reimbursements: refunds };
}

export type IncomeFilters = {
  month?: string;
  from?: string;
  to?: string;
  categoryId?: string;
  method?: IncomeMethod;
};

export async function listIncomes(teamId: string, filters: IncomeFilters = {}) {
  const conds = [eq(incomes.teamId, teamId)];

  if (filters.month) {
    const { start, end } = monthRange(filters.month);
    conds.push(gte(incomes.receivedOn, start), lte(incomes.receivedOn, end));
  }
  if (filters.from) conds.push(gte(incomes.receivedOn, filters.from));
  if (filters.to) conds.push(lte(incomes.receivedOn, filters.to));
  if (filters.categoryId) conds.push(eq(incomes.categoryId, filters.categoryId));
  if (filters.method) conds.push(eq(incomes.method, filters.method));

  return db
    .select({
      id: incomes.id,
      amountCents: incomes.amountCents,
      currency: incomes.currency,
      fxRate: incomes.fxRate,
      baseAmountCents: incomes.baseAmountCents,
      method: incomes.method,
      description: incomes.description,
      receivedOn: incomes.receivedOn,
      createdAt: incomes.createdAt,
      categoryName: categories.name,
      subcategoryName: subcategories.name,
      createdBy: users.displayName,
    })
    .from(incomes)
    .innerJoin(categories, eq(categories.id, incomes.categoryId))
    .leftJoin(subcategories, eq(subcategories.id, incomes.subcategoryId))
    .innerJoin(users, eq(users.id, incomes.createdByUserId))
    .where(and(...conds))
    .orderBy(desc(incomes.receivedOn), desc(incomes.createdAt));
}

export async function getIncome(teamId: string, id: string) {
  const [income] = await db
    .select({
      id: incomes.id,
      amountCents: incomes.amountCents,
      currency: incomes.currency,
      fxRate: incomes.fxRate,
      baseAmountCents: incomes.baseAmountCents,
      method: incomes.method,
      description: incomes.description,
      receivedOn: incomes.receivedOn,
      createdAt: incomes.createdAt,
      categoryId: incomes.categoryId,
      subcategoryId: incomes.subcategoryId,
      categoryName: categories.name,
      subcategoryName: subcategories.name,
      createdBy: users.displayName,
    })
    .from(incomes)
    .innerJoin(categories, eq(categories.id, incomes.categoryId))
    .leftJoin(subcategories, eq(subcategories.id, incomes.subcategoryId))
    .innerJoin(users, eq(users.id, incomes.createdByUserId))
    .where(and(eq(incomes.id, id), eq(incomes.teamId, teamId)))
    .limit(1);

  return income ?? null;
}

export async function getMonthlyDashboard(teamId: string, month: string) {
  const { start, end } = monthRange(month);
  const inMonth = and(
    eq(expenses.teamId, teamId),
    gte(expenses.spentOn, start),
    lte(expenses.spentOn, end),
  );

  const byCategory = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      totalCents: sql<number>`sum(${expenses.baseAmountCents})`,
      count: sql<number>`count(*)`,
    })
    .from(expenses)
    .innerJoin(categories, eq(categories.id, expenses.categoryId))
    .where(inMonth)
    .groupBy(categories.id, categories.name)
    .orderBy(sql`sum(${expenses.baseAmountCents}) desc`);

  const byMethod = await db
    .select({
      paymentMethod: expenses.paymentMethod,
      totalCents: sql<number>`sum(${expenses.baseAmountCents})`,
    })
    .from(expenses)
    .where(inMonth)
    .groupBy(expenses.paymentMethod);

  const [totals] = await db
    .select({
      totalCents: sql<number>`coalesce(sum(${expenses.baseAmountCents}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(expenses)
    .where(inMonth);

  const [refunds] = await db
    .select({
      totalCents: sql<number>`coalesce(sum(${reimbursements.baseAmountCents}), 0)`,
    })
    .from(reimbursements)
    .where(
      and(
        eq(reimbursements.teamId, teamId),
        gte(reimbursements.reimbursedOn, start),
        lte(reimbursements.reimbursedOn, end),
      ),
    );

  const inMonthInc = and(
    eq(incomes.teamId, teamId),
    gte(incomes.receivedOn, start),
    lte(incomes.receivedOn, end),
  );

  const [incTotals] = await db
    .select({
      totalCents: sql<number>`coalesce(sum(${incomes.baseAmountCents}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(incomes)
    .where(inMonthInc);

  const incByCategory = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      totalCents: sql<number>`sum(${incomes.baseAmountCents})`,
      count: sql<number>`count(*)`,
    })
    .from(incomes)
    .innerJoin(categories, eq(categories.id, incomes.categoryId))
    .where(inMonthInc)
    .groupBy(categories.id, categories.name)
    .orderBy(sql`sum(${incomes.baseAmountCents}) desc`);

  const grossCents = Number(totals?.totalCents ?? 0);
  const reimbursedCents = Number(refunds?.totalCents ?? 0);
  const netCents = grossCents - reimbursedCents;
  const incomeCents = Number(incTotals?.totalCents ?? 0);

  return {
    month,
    grossCents,
    reimbursedCents,
    netCents,
    incomeCents,
    balanceCents: incomeCents - netCents,
    count: Number(totals?.count ?? 0),
    incomeCount: Number(incTotals?.count ?? 0),
    byCategory: byCategory.map((r) => ({ ...r, totalCents: Number(r.totalCents) })),
    byMethod: byMethod.map((r) => ({ ...r, totalCents: Number(r.totalCents) })),
    incomeByCategory: incByCategory.map((r) => ({
      ...r,
      totalCents: Number(r.totalCents),
      count: Number(r.count),
    })),
  };
}

export async function getTeamMembers(teamId: string) {
  return db
    .select({
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      photoUrl: users.photoUrl,
      role: teamMembers.role,
      joinedAt: teamMembers.createdAt,
      telegramLinked: sql<boolean>`${telegramLinks.linkedAt} is not null`,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .leftJoin(telegramLinks, eq(telegramLinks.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(teamMembers.createdAt);
}

export async function getTelegramLink(userId: string) {
  const [row] = await db
    .select({ linked: telegramLinks.linkedAt })
    .from(telegramLinks)
    .where(eq(telegramLinks.userId, userId))
    .limit(1);
  return { linked: Boolean(row?.linked) };
}

export async function getInvitationPreview(token: string) {
  const [row] = await db
    .select({
      teamName: teams.name,
      status: teamInvitations.status,
      expiresAt: teamInvitations.expiresAt,
    })
    .from(teamInvitations)
    .innerJoin(teams, eq(teams.id, teamInvitations.teamId))
    .where(eq(teamInvitations.token, token))
    .limit(1);

  if (!row) return null;
  const valid = row.status === "pending" && row.expiresAt > new Date();
  return { teamName: row.teamName, valid };
}

export async function getPendingInvitations(teamId: string) {
  return db
    .select()
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.status, "pending"),
      ),
    )
    .orderBy(desc(teamInvitations.createdAt));
}
