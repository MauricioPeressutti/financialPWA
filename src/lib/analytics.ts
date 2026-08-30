import "server-only";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  expenses,
  incomes,
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
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Índice de color (0-5) estable para una categoría, según su posición
 *  alfabética dentro de la lista completa. "Otros" siempre cae en el 5. */
export function buildCategoryColors(allNames: string[]): Record<string, number> {
  const sorted = [...allNames].sort((a, b) => a.localeCompare(b, "es"));
  const map: Record<string, number> = {};
  let i = 0;
  for (const name of sorted) {
    if (/^otros$/i.test(name)) map[name] = 5;
    else {
      map[name] = i % 5; // 0..4 para las "normales"
      i++;
    }
  }
  return map;
}

// ─────────────────────────────────────────────────────────
export async function getAnalytics(
  teamId: string,
  from: string,
  to: string,
  currency: string,
  memberId?: string,
) {
  const mE = memberId ? [eq(expenses.createdByUserId, memberId)] : [];
  const mI = memberId ? [eq(incomes.createdByUserId, memberId)] : [];

  const inRange = and(
    eq(expenses.teamId, teamId),
    eq(expenses.currency, currency),
    gte(expenses.spentOn, from),
    lte(expenses.spentOn, to),
    ...mE,
  );
  const refInRange = and(
    eq(reimbursements.teamId, teamId),
    eq(reimbursements.currency, currency),
    gte(reimbursements.reimbursedOn, from),
    lte(reimbursements.reimbursedOn, to),
    ...mE,
  );
  const incInRange = and(
    eq(incomes.teamId, teamId),
    eq(incomes.currency, currency),
    gte(incomes.receivedOn, from),
    lte(incomes.receivedOn, to),
    ...mI,
  );

  const [
    totalsRow,
    refTotalRow,
    incTotalRow,
    catRows,
    catRefRows,
    subRows,
    methodRows,
    memberRows,
    memberRefRows,
    memberCatRows,
    dayRows,
    topExpRows,
    topIncRows,
    incSourceRows,
    incMemberRows,
  ] = await Promise.all([
    db
      .select({
        gross: sql<number>`coalesce(sum(${expenses.amountCents}), 0)`,
        count: sql<number>`count(*)`,
        max: sql<number>`coalesce(max(${expenses.amountCents}), 0)`,
        minDate: sql<string | null>`min(${expenses.spentOn})`,
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
        total: sql<number>`coalesce(sum(${incomes.amountCents}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(incomes)
      .where(incInRange),
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
        userId: expenses.createdByUserId,
        categoryName: categories.name,
        gross: sql<number>`sum(${expenses.amountCents})`,
      })
      .from(expenses)
      .innerJoin(categories, eq(categories.id, expenses.categoryId))
      .where(inRange)
      .groupBy(expenses.createdByUserId, categories.name),
    db
      .select({
        d: expenses.spentOn,
        gross: sql<number>`sum(${expenses.amountCents})`,
        count: sql<number>`count(*)`,
      })
      .from(expenses)
      .where(inRange)
      .groupBy(expenses.spentOn),
    db
      .select({
        id: expenses.id,
        amountCents: expenses.amountCents,
        currency: expenses.currency,
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
    db
      .select({
        id: incomes.id,
        amountCents: incomes.amountCents,
        currency: incomes.currency,
        method: incomes.method,
        receivedOn: incomes.receivedOn,
        categoryName: categories.name,
        subcategoryName: subcategories.name,
        createdBy: users.displayName,
      })
      .from(incomes)
      .innerJoin(categories, eq(categories.id, incomes.categoryId))
      .leftJoin(subcategories, eq(subcategories.id, incomes.subcategoryId))
      .innerJoin(users, eq(users.id, incomes.createdByUserId))
      .where(incInRange)
      .orderBy(desc(incomes.amountCents))
      .limit(10),
    db
      .select({
        name: categories.name,
        total: sql<number>`sum(${incomes.amountCents})`,
        count: sql<number>`count(*)`,
      })
      .from(incomes)
      .innerJoin(categories, eq(categories.id, incomes.categoryId))
      .where(incInRange)
      .groupBy(categories.id, categories.name)
      .orderBy(desc(sql`sum(${incomes.amountCents})`)),
    db
      .select({
        name: users.displayName,
        email: users.email,
        total: sql<number>`sum(${incomes.amountCents})`,
        count: sql<number>`count(*)`,
      })
      .from(incomes)
      .innerJoin(users, eq(users.id, incomes.createdByUserId))
      .where(incInRange)
      .groupBy(users.id, users.displayName, users.email)
      .orderBy(desc(sql`sum(${incomes.amountCents})`)),
  ]);

  const grossCents = n(totalsRow[0]?.gross);
  const reimbursedCents = n(refTotalRow[0]?.total);
  const netCents = grossCents - reimbursedCents;
  const count = n(totalsRow[0]?.count);
  const incomeCents = n(incTotalRow[0]?.total);

  // ---- días ----
  const days = dayRows
    .map((r) => ({ date: String(r.d), cents: n(r.gross), count: n(r.count) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const today = iso(new Date());
  const lastDay = today < to ? today : to;
  const firstDay = totalsRow[0]?.minDate
    ? String(totalsRow[0].minDate) > from
      ? String(totalsRow[0].minDate)
      : from
    : from;
  const spanDays = Math.max(
    1,
    Math.round((new Date(lastDay).getTime() - new Date(firstDay).getTime()) / 86400000) + 1,
  );
  const daysActive = days.length;
  const daysNoSpend = Math.max(0, spanDays - daysActive);
  const maxDay = days.reduce(
    (m, d) => (d.cents > m.cents ? d : m),
    { date: "", cents: 0, count: 0 },
  );

  // ---- por día de semana (promedio) ----
  const dowSum = Array(7).fill(0);
  const dowDays = Array(7).fill(0);
  days.forEach((d) => {
    const g = new Date(d.date + "T00:00:00").getDay();
    dowSum[g] += d.cents;
    dowDays[g] += 1;
  });
  const byWeekday = Array.from({ length: 7 }, (_, dow) => ({
    dow,
    grossCents: dowSum[dow],
    avgCents: dowDays[dow] ? Math.round(dowSum[dow] / dowDays[dow]) : 0,
  }));

  // ---- categorías ----
  const catRefMap = new Map(catRefRows.map((r) => [r.categoryId, n(r.refunded)]));
  const byCategory = catRows.map((r) => {
    const g = n(r.gross);
    const refunded = catRefMap.get(r.categoryId) ?? 0;
    return {
      name: r.name,
      grossCents: g,
      netCents: g - refunded,
      count: n(r.count),
      pct: grossCents ? (g / grossCents) * 100 : 0,
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

  // ---- miembros ----
  const memberRefMap = new Map(memberRefRows.map((r) => [r.userId, n(r.refunded)]));
  const memberCatMap = new Map<string, { name: string; cents: number }[]>();
  memberCatRows.forEach((r) => {
    const arr = memberCatMap.get(r.userId) ?? [];
    arr.push({ name: r.categoryName, cents: n(r.gross) });
    memberCatMap.set(r.userId, arr);
  });
  const byMember = memberRows.map((r) => {
    const g = n(r.gross);
    const refunded = memberRefMap.get(r.userId) ?? 0;
    const c = n(r.count);
    return {
      userId: r.userId,
      name: r.name ?? r.email,
      grossCents: g,
      netCents: g - refunded,
      count: c,
      avgTicketCents: c ? Math.round(g / c) : 0,
      pct: grossCents ? (g / grossCents) * 100 : 0,
      byCategory: (memberCatMap.get(r.userId) ?? []).sort((a, b) => b.cents - a.cents),
    };
  });

  // ---- top movimientos (gastos + ingresos) ----
  const topMovements = [
    ...topExpRows.map((r) => ({
      id: r.id,
      kind: "gasto" as const,
      amountCents: r.amountCents,
      currency: r.currency,
      netCents: r.amountCents - n(r.refunded),
      label: r.categoryName + (r.subcategoryName ? ` · ${r.subcategoryName}` : ""),
      method: r.paymentMethod as string,
      on: String(r.spentOn),
      createdBy: r.createdBy,
    })),
    ...topIncRows.map((r) => ({
      id: r.id,
      kind: "ingreso" as const,
      amountCents: r.amountCents,
      currency: r.currency,
      netCents: r.amountCents,
      label: r.categoryName + (r.subcategoryName ? ` · ${r.subcategoryName}` : ""),
      method: r.method as string,
      on: String(r.receivedOn),
      createdBy: r.createdBy,
    })),
  ]
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, 8);

  const incomeBySource = incSourceRows.map((r) => ({
    name: r.name,
    totalCents: n(r.total),
    count: n(r.count),
    pct: incomeCents ? (n(r.total) / incomeCents) * 100 : 0,
  }));
  const incomeByMember = incMemberRows.map((r) => ({
    name: r.name ?? r.email,
    totalCents: n(r.total),
    count: n(r.count),
    pct: incomeCents ? (n(r.total) / incomeCents) * 100 : 0,
  }));

  return {
    kpis: {
      grossCents,
      reimbursedCents,
      netCents,
      incomeCents,
      balanceCents: incomeCents - netCents,
      count,
      incomeCount: n(incTotalRow[0]?.count),
      maxExpenseCents: n(totalsRow[0]?.max),
      avgTicketCents: count ? Math.round(grossCents / count) : 0,
      avgPerDayCents: Math.round(netCents / spanDays),
      refundRatePct: grossCents ? (reimbursedCents / grossCents) * 100 : 0,
      refundCount: n(refTotalRow[0]?.count),
      spanDays,
      daysActive,
      daysNoSpend,
      maxDayCents: maxDay.cents,
      maxDayDate: maxDay.date,
    },
    byCategory,
    bySubcategory,
    byPaymentMethod,
    byMember,
    byWeekday,
    days,
    topMovements,
    incomeBySource,
    incomeByMember,
  };
}

export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;

// ─────────────────────────────────────────────────────────
/** Gasto bruto por día de los últimos `days` días — para el mapa de calor,
 *  que siempre muestra una ventana fija (independiente del filtro de tiempo). */
export async function getDailySpend(
  teamId: string,
  days: number,
  currency = "ARS",
  memberId?: string,
) {
  const start = new Date();
  start.setDate(start.getDate() - days);
  const mE = memberId ? [eq(expenses.createdByUserId, memberId)] : [];

  const rows = await db
    .select({
      d: expenses.spentOn,
      gross: sql<number>`sum(${expenses.amountCents})`,
      count: sql<number>`count(*)`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.teamId, teamId),
        eq(expenses.currency, currency),
        gte(expenses.spentOn, iso(start)),
        ...mE,
      ),
    )
    .groupBy(expenses.spentOn);

  return rows
    .map((r) => ({ date: String(r.d), cents: n(r.gross), count: n(r.count) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type DailySpend = Awaited<ReturnType<typeof getDailySpend>>;

// ─────────────────────────────────────────────────────────
export async function getMonthlyTrend(
  teamId: string,
  months = 12,
  currency = "ARS",
  memberId?: string,
) {
  const start = new Date();
  start.setDate(1);
  start.setMonth(start.getMonth() - (months - 1));
  const from = iso(start);
  const mE = memberId ? [eq(expenses.createdByUserId, memberId)] : [];
  const mI = memberId ? [eq(incomes.createdByUserId, memberId)] : [];

  const [spend, refunds, income] = await Promise.all([
    db
      .select({
        month: sql<string>`to_char(${expenses.spentOn}, 'YYYY-MM')`,
        gross: sql<number>`sum(${expenses.amountCents})`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.teamId, teamId),
          eq(expenses.currency, currency),
          gte(expenses.spentOn, from),
          ...mE,
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
          eq(reimbursements.currency, currency),
          gte(reimbursements.reimbursedOn, from),
          ...mE,
        ),
      )
      .groupBy(sql`to_char(${reimbursements.reimbursedOn}, 'YYYY-MM')`),
    db
      .select({
        month: sql<string>`to_char(${incomes.receivedOn}, 'YYYY-MM')`,
        total: sql<number>`sum(${incomes.amountCents})`,
      })
      .from(incomes)
      .where(
        and(
          eq(incomes.teamId, teamId),
          eq(incomes.currency, currency),
          gte(incomes.receivedOn, from),
          ...mI,
        ),
      )
      .groupBy(sql`to_char(${incomes.receivedOn}, 'YYYY-MM')`),
  ]);

  const sMap = new Map(spend.map((r) => [r.month, n(r.gross)]));
  const rMap = new Map(refunds.map((r) => [r.month, n(r.refunded)]));
  const iMap = new Map(income.map((r) => [r.month, n(r.total)]));

  return Array.from({ length: months }, (_, i) => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    const key = iso(d).slice(0, 7);
    const gross = sMap.get(key) ?? 0;
    const refunded = rMap.get(key) ?? 0;
    return {
      month: key,
      label: d.toLocaleDateString("es-AR", { month: "short" }).replace(".", ""),
      grossCents: gross,
      reimbursedCents: refunded,
      netCents: gross - refunded,
      incomeCents: iMap.get(key) ?? 0,
    };
  });
}

export type MonthlyTrend = Awaited<ReturnType<typeof getMonthlyTrend>>;

// ─────────────────────────────────────────────────────────
/** Ritmo del mes en curso vs el anterior (gasto neto acumulado por día). */
export async function getSpendPace(
  teamId: string,
  currency = "ARS",
  memberId?: string,
) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const dom = now.getDate();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysPrevMonth = new Date(y, m, 0).getDate();
  const prevStart = iso(new Date(y, m - 1, 1));
  const mE = memberId ? [eq(expenses.createdByUserId, memberId)] : [];

  const [expRows, refRows] = await Promise.all([
    db
      .select({ d: expenses.spentOn, amount: sql<number>`sum(${expenses.amountCents})` })
      .from(expenses)
      .where(
        and(
          eq(expenses.teamId, teamId),
          eq(expenses.currency, currency),
          gte(expenses.spentOn, prevStart),
          ...mE,
        ),
      )
      .groupBy(expenses.spentOn),
    db
      .select({ d: reimbursements.reimbursedOn, amount: sql<number>`sum(${reimbursements.amountCents})` })
      .from(reimbursements)
      .innerJoin(expenses, eq(expenses.id, reimbursements.expenseId))
      .where(
        and(
          eq(reimbursements.teamId, teamId),
          eq(reimbursements.currency, currency),
          gte(reimbursements.reimbursedOn, prevStart),
          ...mE,
        ),
      )
      .groupBy(reimbursements.reimbursedOn),
  ]);

  const net: Record<string, number> = {};
  expRows.forEach((r) => (net[String(r.d)] = (net[String(r.d)] || 0) + n(r.amount)));
  refRows.forEach((r) => (net[String(r.d)] = (net[String(r.d)] || 0) - n(r.amount)));

  const curKey = iso(new Date(y, m, 1)).slice(0, 7);
  const prevKey = iso(new Date(y, m - 1, 1)).slice(0, 7);
  const curDaily = Array(daysInMonth).fill(0);
  const prevDaily = Array(daysPrevMonth).fill(0);
  Object.entries(net).forEach(([d, v]) => {
    const day = Number(d.slice(8, 10)) - 1;
    if (d.slice(0, 7) === curKey && day < daysInMonth) curDaily[day] += v;
    else if (d.slice(0, 7) === prevKey && day < daysPrevMonth) prevDaily[day] += v;
  });
  const cum = (a: number[]) => a.reduce<number[]>((acc, v, i) => (acc.push((acc[i - 1] || 0) + v), acc), []);
  const curCum = cum(curDaily).slice(0, dom);
  const prevCum = cum(prevDaily);

  const curTotal = curCum[curCum.length - 1] || 0;
  const prevToDate = prevCum[Math.min(dom, prevCum.length) - 1] || 0;
  const dailyRate = curTotal / dom;

  return {
    daysInMonth,
    dom,
    curCum,
    prevCum,
    curTotalCents: curTotal,
    prevToDateCents: prevToDate,
    prevFullCents: prevCum[prevCum.length - 1] || 0,
    projectionCents: Math.round(dailyRate * daysInMonth),
    vsPrevPct: prevToDate ? ((curTotal - prevToDate) / prevToDate) * 100 : 0,
    monthLabel: new Date(y, m, 1).toLocaleDateString("es-AR", { month: "long" }),
    prevMonthLabel: new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long" }),
  };
}

export type SpendPace = Awaited<ReturnType<typeof getSpendPace>>;
