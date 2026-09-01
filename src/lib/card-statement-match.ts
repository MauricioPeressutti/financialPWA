import "server-only";

import { and, eq, gte, isNull, lte, or } from "drizzle-orm";

import { db } from "@/db";
import { categories, expenses, teams } from "@/db/schema";
import type { ParsedStatement, StatementLine } from "@/lib/card-statement";

export type LineView = StatementLine & { idx: number };

export type ExpenseRef = {
  id: string;
  description: string | null;
  amountCents: number;
  currency: string;
  spentOn: string;
  categoryName: string;
};

export type MatchResult = {
  nuevos: LineView[];
  previos: LineView[]; // consumos con fecha anterior al alta del equipo
  yaCargados: { line: LineView; expense: ExpenseRef; needsFix: boolean }[];
  dudosos: { line: LineView; candidatos: ExpenseRef[] }[];
  cargos: {
    totalCents: number;
    breakdown: { description: string; amountCents: number }[];
  };
  teamCreatedOn: string;
  counts: {
    nuevos: number;
    previos: number;
    yaCargados: number;
    dudosos: number;
  };
};

const DAY = 86400000;
const daysApart = (a: string, b: string) =>
  Math.abs(
    (new Date(a + "T00:00:00").getTime() - new Date(b + "T00:00:00").getTime()) /
      DAY,
  );

const tightTol = (cents: number) => Math.max(100_000, cents * 0.12); // $1.000 / 12%
const wideTol = (cents: number) => Math.max(300_000, cents * 0.25); // $3.000 / 25%

/** Cruza los consumos de un resumen contra los gastos `crédito` ya cargados. */
export async function matchStatement(
  teamId: string,
  statement: ParsedStatement,
): Promise<MatchResult> {
  const [team] = await db
    .select({ createdAt: teams.createdAt })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  const teamCreatedOn = (team?.createdAt ?? new Date())
    .toISOString()
    .slice(0, 10);

  const consumoLines: LineView[] = statement.lines
    .map((l, idx) => ({ ...l, idx }))
    .filter((l) => l.kind === "consumo" || l.kind === "cuota");

  const cargoLines = statement.lines.filter(
    (l) => l.kind === "impuesto" || l.kind === "interes",
  );
  const cargos = {
    totalCents: cargoLines.reduce((s, l) => s + l.amountCents, 0),
    breakdown: cargoLines.map((l) => ({
      description: l.description,
      amountCents: l.amountCents,
    })),
  };

  const empty = (): MatchResult => ({
    nuevos: [],
    previos: [],
    yaCargados: [],
    dudosos: [],
    cargos,
    teamCreatedOn,
    counts: { nuevos: 0, previos: 0, yaCargados: 0, dudosos: 0 },
  });

  if (consumoLines.length === 0) return empty();

  const dates = consumoLines.map((l) => l.date).sort();
  const from = new Date(dates[0] + "T00:00:00");
  from.setDate(from.getDate() - 8);
  const to = new Date(dates[dates.length - 1] + "T00:00:00");
  to.setDate(to.getDate() + 8);

  const existing: ExpenseRef[] = (
    await db
      .select({
        id: expenses.id,
        description: expenses.description,
        amountCents: expenses.amountCents,
        currency: expenses.currency,
        spentOn: expenses.spentOn,
        categoryName: categories.name,
      })
      .from(expenses)
      .innerJoin(categories, eq(categories.id, expenses.categoryId))
      .where(
        and(
          eq(expenses.teamId, teamId),
          isNull(expenses.statementId),
          or(
            eq(expenses.paymentMethod, "credito"),
            eq(expenses.paymentMethod, "modo_credito"),
          ),
          gte(expenses.spentOn, from.toISOString().slice(0, 10)),
          lte(expenses.spentOn, to.toISOString().slice(0, 10)),
        ),
      )
  ).map((e) => ({
    id: e.id,
    description: e.description,
    amountCents: e.amountCents,
    currency: e.currency,
    spentOn: String(e.spentOn),
    categoryName: e.categoryName,
  }));

  type Pair = { li: number; ei: number; dAmt: number; dDay: number };
  const pairs: Pair[] = [];
  const candCount = new Array(consumoLines.length).fill(0);

  consumoLines.forEach((line, li) => {
    existing.forEach((exp, ei) => {
      if (exp.currency !== line.currency) return;
      const dDay = daysApart(line.date, exp.spentOn);
      if (dDay > 7) return;
      const dAmt = Math.abs(line.amountCents - exp.amountCents);
      if (dAmt > wideTol(line.amountCents)) return;
      pairs.push({ li, ei, dAmt, dDay });
      candCount[li]++;
    });
  });

  pairs.sort((a, b) => a.dAmt - b.dAmt || a.dDay - b.dDay);

  const takenLine = new Set<number>();
  const takenExp = new Set<number>();
  const assigned = new Map<number, Pair>();
  for (const p of pairs) {
    if (takenLine.has(p.li) || takenExp.has(p.ei)) continue;
    takenLine.add(p.li);
    takenExp.add(p.ei);
    assigned.set(p.li, p);
  }

  const result = empty();

  consumoLines.forEach((line, li) => {
    const a = assigned.get(li);
    if (a) {
      const exp = existing[a.ei];
      const tight = a.dAmt <= tightTol(line.amountCents);
      if (tight && candCount[li] === 1) {
        result.yaCargados.push({ line, expense: exp, needsFix: a.dAmt > 0 });
        return;
      }
      const cands = pairs
        .filter((p) => p.li === li)
        .slice(0, 3)
        .map((p) => existing[p.ei]);
      result.dudosos.push({ line, candidatos: cands });
      return;
    }
    if (line.date < teamCreatedOn) result.previos.push(line);
    else result.nuevos.push(line);
  });

  result.counts = {
    nuevos: result.nuevos.length,
    previos: result.previos.length,
    yaCargados: result.yaCargados.length,
    dudosos: result.dudosos.length,
  };
  return result;
}
