"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { cardStatements, expenses } from "@/db/schema";
import { requireTeam } from "@/lib/auth";
import type { ParsedStatement } from "@/lib/card-statement";
import { resolveCategory, resolveSubcategory } from "@/lib/categories-resolve";
import { insertExpense } from "@/lib/expenses-core";
import { getActiveCategories } from "@/lib/queries";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

type ImportLog = {
  created: string[];
  linked: { id: string; prevAmountCents: number }[];
};

function revalidate(id?: string) {
  revalidatePath("/tarjetas");
  revalidatePath("/");
  revalidatePath("/movimientos");
  revalidatePath("/analytics");
  if (id) revalidatePath(`/tarjetas/${id}/revisar`);
}

async function loadStatement(teamId: string, id: string) {
  const [row] = await db
    .select()
    .from(cardStatements)
    .where(and(eq(cardStatements.id, id), eq(cardStatements.teamId, teamId)))
    .limit(1);
  return row ?? null;
}

export type ImportPayload = {
  statementId: string;
  /** líneas a cargar como gasto nuevo (nuevos + previos-que-se-quedan + dudosos-nuevos) */
  imports: { idx: number; categoryName: string; dateMode?: "real" | "period" }[];
  /** líneas que ya estaban cargadas: atar el gasto al resumen (+ ajustar monto) */
  links: { idx: number; expenseId: string; applyFix: boolean }[];
  importCargos: boolean;
};

export async function importStatement(
  payload: ImportPayload,
): Promise<ActionResult<{ created: number; linked: number }>> {
  const { user, team } = await requireTeam();
  const st = await loadStatement(team.id, payload.statementId);
  if (!st) return { ok: false, error: "Resumen no encontrado" };
  const parsed = st.raw as ParsedStatement | null;
  if (!parsed) return { ok: false, error: "El resumen no tiene datos para importar" };

  const expCats = await getActiveCategories(team.id, "expense");
  const period =
    parsed.closingDate ?? parsed.dueDate ?? new Date().toISOString().slice(0, 10);

  const log: ImportLog = { created: [], linked: [] };

  // ── consumos nuevos ──
  for (const imp of payload.imports) {
    const line = parsed.lines[imp.idx];
    if (!line) continue;
    const cat =
      resolveCategory(expCats, imp.categoryName || line.category || "Otros") ??
      resolveCategory(expCats, "Otros");
    if (!cat) continue;
    const sub = resolveSubcategory(cat, imp.categoryName);
    const spentOn =
      line.installment || imp.dateMode === "period" ? period : line.date;
    const desc =
      line.description + (line.installment ? ` (cuota ${line.installment})` : "");
    const { id } = await insertExpense(team.id, user.id, {
      amountCents: line.amountCents,
      currency: line.currency,
      categoryId: cat.id,
      subcategoryId: sub?.id ?? null,
      paymentMethod: "credito",
      description: desc.slice(0, 160),
      spentOn: /^\d{4}-\d{2}-\d{2}$/.test(spentOn) ? spentOn : period,
    });
    log.created.push(id);
  }

  // ── cargos e impuestos agrupados ──
  if (payload.importCargos) {
    const cargos = parsed.lines.filter(
      (l) => l.kind === "impuesto" || l.kind === "interes",
    );
    const totalCents = cargos.reduce((s, l) => s + l.amountCents, 0);
    if (totalCents > 0) {
      const cat =
        resolveCategory(expCats, "Servicios") ??
        resolveCategory(expCats, "Otros");
      if (cat) {
        const { id } = await insertExpense(team.id, user.id, {
          amountCents: totalCents,
          currency: "ARS",
          categoryId: cat.id,
          paymentMethod: "credito",
          description: `Cargos e impuestos — ${st.label}`.slice(0, 160),
          spentOn: period,
        });
        log.created.push(id);
      }
    }
  }

  // ── ya cargados: atar al resumen (+ ajustar monto real) ──
  for (const lnk of payload.links) {
    const line = parsed.lines[lnk.idx];
    if (!line) continue;
    const [exp] = await db
      .select({
        id: expenses.id,
        amountCents: expenses.amountCents,
        fxRate: expenses.fxRate,
      })
      .from(expenses)
      .where(and(eq(expenses.id, lnk.expenseId), eq(expenses.teamId, team.id)))
      .limit(1);
    if (!exp) continue;
    const set: Record<string, unknown> = { statementId: st.id };
    if (lnk.applyFix && line.amountCents !== exp.amountCents) {
      set.amountCents = line.amountCents;
      set.baseAmountCents = Math.round(line.amountCents * (exp.fxRate || 1));
      set.updatedAt = new Date();
    }
    await db.update(expenses).set(set).where(eq(expenses.id, exp.id));
    log.linked.push({ id: exp.id, prevAmountCents: exp.amountCents });
  }

  await db
    .update(cardStatements)
    .set({ status: "imported", importLog: log })
    .where(eq(cardStatements.id, st.id));

  revalidate(st.id);
  return { ok: true, created: log.created.length, linked: log.linked.length };
}

export async function undoStatementImport(id: string): Promise<ActionResult> {
  const { team } = await requireTeam();
  const st = await loadStatement(team.id, id);
  if (!st) return { ok: false, error: "No encontrado" };
  const log = (st.importLog as ImportLog | null) ?? { created: [], linked: [] };

  if (log.created.length) {
    await db
      .delete(expenses)
      .where(
        and(
          eq(expenses.teamId, team.id),
          inArray(expenses.id, log.created),
        ),
      );
  }
  for (const l of log.linked) {
    await db
      .update(expenses)
      .set({ statementId: null, amountCents: l.prevAmountCents })
      .where(and(eq(expenses.id, l.id), eq(expenses.teamId, team.id)));
  }
  // por las dudas, desatar cualquier otro gasto que haya quedado con este statement_id
  await db
    .update(expenses)
    .set({ statementId: null })
    .where(eq(expenses.statementId, st.id));

  await db
    .update(cardStatements)
    .set({ status: "reminder_only", importLog: null })
    .where(eq(cardStatements.id, st.id));

  revalidate(st.id);
  return { ok: true };
}

export async function markStatementPaid(
  id: string,
  paid: boolean,
): Promise<ActionResult> {
  const { team } = await requireTeam();
  const st = await loadStatement(team.id, id);
  if (!st) return { ok: false, error: "No encontrado" };
  const next = paid
    ? "paid"
    : (st.importLog as ImportLog | null)?.created?.length
      ? "imported"
      : "reminder_only";
  await db
    .update(cardStatements)
    .set({ status: next })
    .where(eq(cardStatements.id, st.id));
  revalidate(st.id);
  return { ok: true };
}

export async function dismissStatement(id: string): Promise<ActionResult> {
  const { team } = await requireTeam();
  const st = await loadStatement(team.id, id);
  if (!st) return { ok: false, error: "No encontrado" };
  // desatar gastos y borrar los creados por la importación
  const log = (st.importLog as ImportLog | null) ?? { created: [], linked: [] };
  if (log.created.length) {
    await db
      .delete(expenses)
      .where(
        and(eq(expenses.teamId, team.id), inArray(expenses.id, log.created)),
      );
  }
  await db
    .update(expenses)
    .set({ statementId: null })
    .where(eq(expenses.statementId, st.id));
  await db.delete(cardStatements).where(eq(cardStatements.id, st.id));
  revalidate();
  return { ok: true };
}
