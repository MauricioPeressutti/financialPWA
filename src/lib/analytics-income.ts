import "server-only";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, incomes, subcategories, users } from "@/db/schema";

const n = (v: unknown) => Number(v ?? 0);

export async function getIncomeAnalytics(
  teamId: string,
  from: string,
  to: string,
  memberId?: string,
) {
  const memberCond = memberId ? [eq(incomes.createdByUserId, memberId)] : [];
  const inRange = and(
    eq(incomes.teamId, teamId),
    gte(incomes.receivedOn, from),
    lte(incomes.receivedOn, to),
    ...memberCond,
  );

  const [totalsRow, catRows, subRows, methodRows, memberRows, topRows] =
    await Promise.all([
      db
        .select({
          total: sql<number>`coalesce(sum(${incomes.amountCents}), 0)`,
          count: sql<number>`count(*)`,
          max: sql<number>`coalesce(max(${incomes.amountCents}), 0)`,
          minDate: sql<string | null>`min(${incomes.receivedOn})`,
          maxDate: sql<string | null>`max(${incomes.receivedOn})`,
        })
        .from(incomes)
        .where(inRange),
      db
        .select({
          name: categories.name,
          total: sql<number>`sum(${incomes.amountCents})`,
          count: sql<number>`count(*)`,
        })
        .from(incomes)
        .innerJoin(categories, eq(categories.id, incomes.categoryId))
        .where(inRange)
        .groupBy(categories.id, categories.name)
        .orderBy(desc(sql`sum(${incomes.amountCents})`)),
      db
        .select({
          name: subcategories.name,
          categoryName: categories.name,
          total: sql<number>`sum(${incomes.amountCents})`,
          count: sql<number>`count(*)`,
        })
        .from(incomes)
        .innerJoin(subcategories, eq(subcategories.id, incomes.subcategoryId))
        .innerJoin(categories, eq(categories.id, incomes.categoryId))
        .where(inRange)
        .groupBy(subcategories.id, subcategories.name, categories.name)
        .orderBy(desc(sql`sum(${incomes.amountCents})`))
        .limit(8),
      db
        .select({
          method: incomes.method,
          total: sql<number>`sum(${incomes.amountCents})`,
          count: sql<number>`count(*)`,
        })
        .from(incomes)
        .where(inRange)
        .groupBy(incomes.method)
        .orderBy(desc(sql`sum(${incomes.amountCents})`)),
      db
        .select({
          userId: users.id,
          name: users.displayName,
          email: users.email,
          total: sql<number>`sum(${incomes.amountCents})`,
          count: sql<number>`count(*)`,
        })
        .from(incomes)
        .innerJoin(users, eq(users.id, incomes.createdByUserId))
        .where(inRange)
        .groupBy(users.id, users.displayName, users.email)
        .orderBy(desc(sql`sum(${incomes.amountCents})`)),
      db
        .select({
          id: incomes.id,
          amountCents: incomes.amountCents,
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
        .where(inRange)
        .orderBy(desc(incomes.amountCents))
        .limit(10),
    ]);

  const totalCents = n(totalsRow[0]?.total);
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

  const pct = (v: number) => (totalCents ? (v / totalCents) * 100 : 0);

  return {
    kpis: {
      totalCents,
      count,
      maxCents: n(totalsRow[0]?.max),
      avgCents: count ? Math.round(totalCents / count) : 0,
      avgPerDayCents: Math.round(totalCents / spanDays),
      spanDays,
    },
    bySource: catRows.map((r) => ({
      name: r.name,
      totalCents: n(r.total),
      count: n(r.count),
      pct: pct(n(r.total)),
    })),
    bySubcategory: subRows.map((r) => ({
      name: r.name,
      categoryName: r.categoryName,
      totalCents: n(r.total),
      count: n(r.count),
      pct: pct(n(r.total)),
    })),
    byMethod: methodRows.map((r) => ({
      method: r.method,
      totalCents: n(r.total),
      count: n(r.count),
      pct: pct(n(r.total)),
    })),
    byMember: memberRows.map((r) => {
      const total = n(r.total);
      const c = n(r.count);
      return {
        name: r.name ?? r.email,
        totalCents: total,
        count: c,
        avgCents: c ? Math.round(total / c) : 0,
        pct: pct(total),
      };
    }),
    topIncomes: topRows.map((r) => ({
      id: r.id,
      amountCents: r.amountCents,
      method: r.method,
      receivedOn: r.receivedOn,
      categoryName: r.categoryName,
      subcategoryName: r.subcategoryName,
      createdBy: r.createdBy,
    })),
  };
}

export async function getMonthlyIncomeTrend(
  teamId: string,
  months = 12,
  memberId?: string,
) {
  const start = new Date();
  start.setDate(1);
  start.setMonth(start.getMonth() - (months - 1));
  const from = start.toISOString().slice(0, 10);
  const byMember = memberId ? [eq(incomes.createdByUserId, memberId)] : [];

  const rows = await db
    .select({
      month: sql<string>`to_char(${incomes.receivedOn}, 'YYYY-MM')`,
      total: sql<number>`sum(${incomes.amountCents})`,
    })
    .from(incomes)
    .where(
      and(eq(incomes.teamId, teamId), gte(incomes.receivedOn, from), ...byMember),
    )
    .groupBy(sql`to_char(${incomes.receivedOn}, 'YYYY-MM')`);

  const map = new Map(rows.map((r) => [r.month, n(r.total)]));

  return Array.from({ length: months }, (_, i) => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    const key = d.toISOString().slice(0, 7);
    const total = map.get(key) ?? 0;
    return {
      month: key,
      label: d.toLocaleDateString("es-AR", { month: "short" }).replace(".", ""),
      grossCents: total,
      reimbursedCents: 0,
      netCents: total,
    };
  });
}
