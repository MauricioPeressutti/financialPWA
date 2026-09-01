import "server-only";

import { and, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { cardStatements, expenses } from "@/db/schema";
import type { ParsedStatement } from "@/lib/card-statement";

export type StatementRow = typeof cardStatements.$inferSelect & {
  raw: ParsedStatement | null;
};

/** Un resumen del equipo (con su payload parseado tipado). */
export async function getStatement(
  teamId: string,
  id: string,
): Promise<StatementRow | null> {
  const [row] = await db
    .select()
    .from(cardStatements)
    .where(and(eq(cardStatements.id, id), eq(cardStatements.teamId, teamId)))
    .limit(1);
  return (row as StatementRow) ?? null;
}

/** Todos los resúmenes del equipo, más nuevos primero, con cuántos gastos importó cada uno. */
export async function listStatements(teamId: string) {
  const rows = await db
    .select({
      id: cardStatements.id,
      label: cardStatements.label,
      bank: cardStatements.bank,
      brand: cardStatements.brand,
      last4: cardStatements.last4,
      closingDate: cardStatements.closingDate,
      dueDate: cardStatements.dueDate,
      totalArsCents: cardStatements.totalArsCents,
      totalUsdCents: cardStatements.totalUsdCents,
      minPaymentArsCents: cardStatements.minPaymentArsCents,
      status: cardStatements.status,
      createdAt: cardStatements.createdAt,
      importedCount: sql<number>`(
        select count(*)::int from ${expenses} e where e.statement_id = ${cardStatements.id}
      )`,
    })
    .from(cardStatements)
    .where(eq(cardStatements.teamId, teamId))
    .orderBy(desc(cardStatements.dueDate), desc(cardStatements.createdAt));
  return rows;
}

/** El resumen sin pagar cuyo vencimiento está más cerca (para la card de Inicio). */
export async function getUpcomingStatement(teamId: string, withinDays = 10) {
  const limit = new Date();
  limit.setDate(limit.getDate() + withinDays);
  const [row] = await db
    .select({
      id: cardStatements.id,
      label: cardStatements.label,
      dueDate: cardStatements.dueDate,
      totalArsCents: cardStatements.totalArsCents,
      totalUsdCents: cardStatements.totalUsdCents,
      minPaymentArsCents: cardStatements.minPaymentArsCents,
      status: cardStatements.status,
    })
    .from(cardStatements)
    .where(
      and(
        eq(cardStatements.teamId, teamId),
        inArray(cardStatements.status, ["pending", "reminder_only", "imported"]),
        lte(cardStatements.dueDate, limit.toISOString().slice(0, 10)),
        ne(cardStatements.status, "paid"),
      ),
    )
    .orderBy(cardStatements.dueDate)
    .limit(1);
  return row ?? null;
}

/** Un resumen ya existente con el mismo (banco, últimos 4, cierre). */
export async function findDuplicateStatement(
  teamId: string,
  bank: string,
  last4: string,
  closingDate: string | null,
) {
  const [row] = await db
    .select({ id: cardStatements.id, status: cardStatements.status })
    .from(cardStatements)
    .where(
      and(
        eq(cardStatements.teamId, teamId),
        eq(cardStatements.bank, bank),
        eq(cardStatements.last4, last4),
        closingDate
          ? eq(cardStatements.closingDate, closingDate)
          : sql`${cardStatements.closingDate} is null`,
      ),
    )
    .limit(1);
  return row ?? null;
}
