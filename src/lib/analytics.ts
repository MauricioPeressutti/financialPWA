import "server-only";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  expenses,
  reimbursements,
  subcategories,
  users,
} from "@/db/schema";

export {
  RANGE_LABELS,
  RANGE_ORDER,
  resolveRange,
  type AnalyticsRange,
} from "@/lib/analytics-range";

const n = (v: unknown) => Number(v ?? 0);

export async function getAnalytics(
  teamId: string,
  from: string,
  to: string,
  memberId?: string,
) {
  const memberCond = memberId
    ? [eq(expenses.createdByUserId, memberId)]
    : [];

  const inRange = and(
    eq(expenses.teamId, teamId),
    gte(expenses.spentOn, from),
    lte(expenses.spentOn, to),
    ...memberCond,
  );
  // reintegros del período, filtrados por el autor del gasto asociado
  const refInRange = and(
    eq(reimbursements.teamId, teamId),
    gte(reimbursements.reimbursedOn, from),
    lte(reimbursements.reimbursedOn, to),
    ...memberCond,
  );

  const [
    totalsRow,
    refTotalRow,
    catRows,
    catRefRows,
    subRows,
    methodRows,
    memberRows,
    memberRefRows,
    weekdayRows,
    topRows,
  ] = await Promise.all([
    db
      .select({
        gross: sql<number>`coalesce(sum(${expenses.amountCents}), 0)`,
        count: sql<number>`count(*)`,
        max: sql<number>`coalesce(max(${expenses.amountCents}), 0)`,
        minDate: sql<string | null>`min(${expenses.spentOn})`,
        maxDate: sql<string | null>`max(${expenses.spentOn})`,
      })
      .from(expenses)
      .where(inRange),
    db
      .select({
        total: sql<number>`coalesce(sum(${reimbursements.amountCents}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(reimbursements)
      .innerJoin(expenses, eq(expenses.id, reimbursements.expenseId))
      .where(refInRange),
    db
      .select({
        categoryId: categories.id,
        name: categories.name,
        gross: sql<number>`sum(${expenses.amountCents})`,
        count: sql<number>`count(*)`,
      })
      .from(expenses)
      .innerJoin(categories, eq(categories.id, expenses.categoryId))
      .where(inRange)
      .groupBy(categories.id, categories.name)
      .orderBy(desc(sql`sum(${expenses.amountCents})`)),
    db
      .select({
        categoryId: expenses.categoryId,
        refunded: sql<number>`sum(${reimbursements.amountCents})`,
      })
      .from(reimbursements)
      .innerJoin(expenses, eq(expenses.id, reimbursements.expenseId))
      .where(refInRange)
      .groupBy(expenses.categoryId),
    db
      .select({
        name: subcategories.name,
        categoryName: categories.name,
        gross: sql<number>`sum(${expenses.amountCents})`,
        count: sql<number>`count(*)`,
      })
      .from(expenses)
      .innerJoin(subcategories, eq(subcategories.id, expenses.subcategoryId))
      .innerJoin(categories, eq(categories.id, expenses.categoryId))
      .where(inRange)
      .groupBy(subcategories.id, subcategories.name, categories.name)
      .orderBy(desc(sql`sum(${expenses.amountCents})`))
      .limit(8),
    db
      .select({
        method: expenses.paymentMethod,
        gross: sql<number>`sum(${expenses.amountCents})`,
        count: sql<number>`count(*)`,
      })
      .from(expenses)
      .where(inRange)
      .groupBy(expenses.paymentMethod)
      .orderBy(desc(sql`sum(${expenses.amountCents})`)),
    db
      .select({
        userId: users.id,
        name: users.displayName,
        email: users.email,
        gross: sql<number>`sum(${expenses.amountCents})`,
        count: sql<number>`count(*)`,
      })
      .from(expenses)
      .innerJoin(users, eq(users.id, expenses.createdByUserId))
      .where(inRange)
      .groupBy(users.id, users.displayName, users.email)
      .orderBy(desc(sql`sum(${expenses.amountCents})`)),
    db
      .select({
        userId: expenses.createdByUserId,
        refunded: sql<number>`sum(${reimbursements.amountCents})`,
      })
      .from(reimbursements)
      .innerJoin(expenses, eq(expenses.id, reimbursements.expenseId))
      .where(refInRange)
      .groupBy(expenses.createdByUserId),
    db
      .select({
        dow: sql<number>`extract(dow from ${expenses.spentOn})`,
        gross: sql<number>`sum(${expenses.amountCents})`,
        count: sql<number>`count(*)`,
      })
      .from(expenses)
      .where(inRange)
      .groupBy(sql`extract(dow from ${expenses.spentOn})`),
    db
      .select({
        id: expenses.id,
        amountCents: expenses.amountCents,
        paymentMethod: expenses.paymentMethod,
        spentOn: expenses.spentOn,
        categoryName: categories.name,
        subcategoryName: subcategories.name,
        createdBy: users.displayName,
        refunded: sql<number>`coalesce((
          select sum(r.amount_cents) from reimbursements r where r.expense_id = ${expenses.id}
        ), 0)`,
      })
      .from(expenses)
      .innerJoin(categories, eq(categories.id, expenses.categoryId))
      .leftJoin(subcategories, eq(subcategories.id, expenses.subcategoryId))
      .innerJoin(users, eq(users.id, expenses.createdByUserId))
      .where(inRange)
      .orderBy(desc(expenses.amountCents))
      .limit(10),
  ]);

  const grossCents = n(totalsRow[0]?.gross);
  const reimbursedCents = n(refTotalRow[0]?.total);
  const netCents = grossCents - reimbursedCents;
  const count = n(totalsRow[0]?.count);

  const minDate = totalsRow[0]?.minDate ?? from;
  const maxDate = totalsRow[0]?.maxDate ?? to;
  const spanDays =
    Math.max(
      1,
      Math.round(
        (new Date(maxDate).getTime() - new Date(minDate).getTime()) / 86400000,
      ) + 1,
    ) || 1;

  const catRefMap = new Map(catRefRows.map((r) => [r.categoryId, n(r.refunded)]));
  const byCategory = catRows.map((r) => {
    const gross = n(r.gross);
    const refunded = catRefMap.get(r.categoryId) ?? 0;
    return {
      name: r.name,
      grossCents: gross,
      netCents: gross - refunded,
      count: n(r.count),
      pct: grossCents ? (gross / grossCents) * 100 : 0,
    };
  });

  const memberRefMap = new Map(
    memberRefRows.map((r) => [r.userId, n(r.refunded)]),
  );
  const byMember = memberRows.map((r) => {
    const gross = n(r.gross);
    const refunded = memberRefMap.get(r.userId) ?? 0;
    const c = n(r.count);
    return {
      name: r.name ?? r.email,
      grossCents: gross,
      netCents: gross - refunded,
      count: c,
      avgTicketCents: c ? Math.round(gross / c) : 0,
      pct: grossCents ? (gross / grossCents) * 100 : 0,
    };
  });

  const bySubcategory = subRows.map((r) => ({
    name: r.name,
    categoryName: r.categoryName,
    grossCents: n(r.gross),
    count: n(r.count),
    pct: grossCents ? (n(r.gross) / grossCents) * 100 : 0,
  }));

  const byPaymentMethod = methodRows.map((r) => ({
    method: r.method,
    grossCents: n(r.gross),
    count: n(r.count),
    pct: grossCents ? (n(r.gross) / grossCents) * 100 : 0,
  }));

  const weekdayMap = new Map(weekdayRows.map((r) => [n(r.dow), n(r.gross)]));
  const byWeekday = Array.from({ length: 7 }, (_, i) => ({
    dow: i,
    grossCents: weekdayMap.get(i) ?? 0,
  }));

  const topExpenses = topRows.map((r) => ({
    id: r.id,
    amountCents: r.amountCents,
    netCents: r.amountCents - n(r.refunded),
    paymentMethod: r.paymentMethod,
    spentOn: r.spentOn,
    categoryName: r.categoryName,
    subcategoryName: r.subcategoryName,
    createdBy: r.createdBy,
  }));

  return {
    kpis: {
      grossCents,
      reimbursedCents,
      netCents,
      count,
      maxExpenseCents: n(totalsRow[0]?.max),
      avgTicketCents: count ? Math.round(grossCents / count) : 0,
      avgPerDayCents: Math.round(netCents / spanDays),
      refundRatePct: grossCents ? (reimbursedCents / grossCents) * 100 : 0,
      refundCount: n(refTotalRow[0]?.count),
      spanDays,
    },
    byCategory,
    bySubcategory,
    byPaymentMethod,
    byMember,
    byWeekday,
    topExpenses,
  };
}

export async function getMonthlyTrend(
  teamId: string,
  months = 12,
  memberId?: string,
) {
  const start = new Date();
  start.setDate(1);
  start.setMonth(start.getMonth() - (months - 1));
  const from = start.toISOString().slice(0, 10);
  const byMember = memberId ? [eq(expenses.createdByUserId, memberId)] : [];

  const [spend, refunds] = await Promise.all([
    db
      .select({
        month: sql<string>`to_char(${expenses.spentOn}, 'YYYY-MM')`,
        gross: sql<number>`sum(${expenses.amountCents})`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.teamId, teamId),
          gte(expenses.spentOn, from),
          ...byMember,
        ),
      )
      .groupBy(sql`to_char(${expenses.spentOn}, 'YYYY-MM')`),
    db
      .select({
        month: sql<string>`to_char(${reimbursements.reimbursedOn}, 'YYYY-MM')`,
        refunded: sql<number>`sum(${reimbursements.amountCents})`,
      })
      .from(reimbursements)
      .innerJoin(expenses, eq(expenses.id, reimbursements.expenseId))
      .where(
        and(
          eq(reimbursements.teamId, teamId),
          gte(reimbursements.reimbursedOn, from),
          ...byMember,
        ),
      )
      .groupBy(sql`to_char(${reimbursements.reimbursedOn}, 'YYYY-MM')`),
  ]);

  const spendMap = new Map(spend.map((r) => [r.month, n(r.gross)]));
  const refundMap = new Map(refunds.map((r) => [r.month, n(r.refunded)]));

  return Array.from({ length: months }, (_, i) => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    const key = d.toISOString().slice(0, 7);
    const gross = spendMap.get(key) ?? 0;
    const refunded = refundMap.get(key) ?? 0;
    return {
      month: key,
      label: d.toLocaleDateString("es-AR", { month: "short" }).replace(".", ""),
      grossCents: gross,
      reimbursedCents: refunded,
      netCents: gross - refunded,
    };
  });
}
