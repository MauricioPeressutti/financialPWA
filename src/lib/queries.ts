import "server-only";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  expenses,
  reimbursements,
  subcategories,
  teamInvitations,
  teamMembers,
  teams,
  users,
} from "@/db/schema";
import type { PaymentMethod } from "@/lib/payment-methods";

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

export async function getActiveCategories(teamId: string) {
  const cats = await db
    .select()
    .from(categories)
    .where(and(eq(categories.teamId, teamId), eq(categories.archived, false)))
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

  return db
    .select({
      id: expenses.id,
      amountCents: expenses.amountCents,
      paymentMethod: expenses.paymentMethod,
      description: expenses.description,
      spentOn: expenses.spentOn,
      categoryName: categories.name,
      subcategoryName: subcategories.name,
      createdBy: users.displayName,
      reimbursedCents: reimbSum,
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
      paymentMethod: expenses.paymentMethod,
      description: expenses.description,
      spentOn: expenses.spentOn,
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
      totalCents: sql<number>`sum(${expenses.amountCents})`,
      count: sql<number>`count(*)`,
    })
    .from(expenses)
    .innerJoin(categories, eq(categories.id, expenses.categoryId))
    .where(inMonth)
    .groupBy(categories.id, categories.name)
    .orderBy(sql`sum(${expenses.amountCents}) desc`);

  const byMethod = await db
    .select({
      paymentMethod: expenses.paymentMethod,
      totalCents: sql<number>`sum(${expenses.amountCents})`,
    })
    .from(expenses)
    .where(inMonth)
    .groupBy(expenses.paymentMethod);

  const [totals] = await db
    .select({
      totalCents: sql<number>`coalesce(sum(${expenses.amountCents}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(expenses)
    .where(inMonth);

  const [refunds] = await db
    .select({
      totalCents: sql<number>`coalesce(sum(${reimbursements.amountCents}), 0)`,
    })
    .from(reimbursements)
    .where(
      and(
        eq(reimbursements.teamId, teamId),
        gte(reimbursements.reimbursedOn, start),
        lte(reimbursements.reimbursedOn, end),
      ),
    );

  return {
    month,
    grossCents: Number(totals?.totalCents ?? 0),
    reimbursedCents: Number(refunds?.totalCents ?? 0),
    netCents: Number(totals?.totalCents ?? 0) - Number(refunds?.totalCents ?? 0),
    count: Number(totals?.count ?? 0),
    byCategory: byCategory.map((r) => ({ ...r, totalCents: Number(r.totalCents) })),
    byMethod: byMethod.map((r) => ({ ...r, totalCents: Number(r.totalCents) })),
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
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(teamMembers.createdAt);
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
