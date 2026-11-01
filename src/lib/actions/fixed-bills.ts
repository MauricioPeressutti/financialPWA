"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { categories, expenses, fixedBillPayments, fixedBills } from "@/db/schema";
import { requireTeam } from "@/lib/auth";
import { insertExpense } from "@/lib/expenses-core";
import { normalizePeriod } from "@/lib/fixed-bills";
import { fxForMovement } from "@/lib/fx";
import { parseAmountToCents } from "@/lib/money";
import type { PaymentMethod } from "@/lib/payment-methods";
import { fixedBillInput } from "@/lib/validation";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export type FixedBillInput = {
  name: string;
  emoji?: string;
  amount: string; // "15.000" / "15000,50"
  currency?: string; // default: team.primaryCurrency
  categoryId?: string | null; // "" o null = sin categoría
  paymentMethod?: string; // default "debito"
  dueDay?: string | number | null; // "" o null = sin vencimiento
};

const NOT_FOUND = { ok: false as const, error: "Fijo no encontrado" };
const ALREADY_PAID = "Ya está marcado como pagado";
const EXPENSE_TAKEN = "Ese gasto ya está vinculado a otro fijo";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Session = Awaited<ReturnType<typeof requireTeam>>;

function revalidate(withExpense = false) {
  revalidatePath("/movimientos/fijos");
  if (withExpense) {
    revalidatePath("/");
    revalidatePath("/movimientos");
    revalidatePath("/analytics");
    revalidatePath("/esfuerzo");
  }
}

/**
 * Conflictos de unicidad: drizzle los envuelve en DrizzleQueryError y el error
 * de Postgres (code/constraint) viene en `cause`.
 */
function uniqueViolation(err: unknown): string | null {
  const cause = (err as { cause?: { code?: string; constraint?: string } } | null)
    ?.cause;
  if (cause?.code === "23505") return cause.constraint ?? "";
  return null;
}

/** Paso de compensación: si también falla, se loguea y se sigue. */
async function bestEffort(q: PromiseLike<unknown>) {
  try {
    await q;
  } catch (err) {
    console.error("fixed-bills: compensación fallida", err);
  }
}

/** El fijo, solo si es del equipo activo Y del usuario logueado. */
async function findOwnBill(id: string, { user, team }: Session) {
  if (typeof id !== "string" || !UUID_RE.test(id)) return null;
  const [bill] = await db
    .select()
    .from(fixedBills)
    .where(
      and(
        eq(fixedBills.id, id),
        eq(fixedBills.teamId, team.id),
        eq(fixedBills.userId, user.id),
      ),
    )
    .limit(1);
  return bill ?? null;
}

/** Valida el input del formulario (alta/edición) y lo deja listo para guardar. */
async function parseBillInput(
  raw: FixedBillInput,
  team: Session["team"],
): Promise<
  | {
      ok: true;
      values: {
        name: string;
        emoji: string;
        amountCents: number;
        currency: string;
        categoryId: string | null;
        paymentMethod: PaymentMethod;
        dueDay: number | null;
      };
    }
  | { ok: false; error: string }
> {
  const parsed = fixedBillInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const cents = parseAmountToCents(d.amount);
  if (cents === null || cents <= 0) return { ok: false, error: "Monto inválido" };

  const categoryId = d.categoryId || null;
  if (categoryId) {
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.teamId, team.id),
          eq(categories.kind, "expense"),
        ),
      )
      .limit(1);
    if (!cat) return { ok: false, error: "Categoría inválida" };
  }

  const teamCurrencies = team.currencies ?? [];
  const currency =
    d.currency && teamCurrencies.includes(d.currency) ? d.currency : team.primaryCurrency;

  return {
    ok: true,
    values: {
      name: d.name,
      emoji: d.emoji || "🧾",
      amountCents: cents,
      currency,
      categoryId,
      paymentMethod: d.paymentMethod || "debito",
      dueDay: d.dueDay,
    },
  };
}

export async function createFixedBill(
  input: FixedBillInput,
): Promise<ActionResult<{ id: string }>> {
  const { user, team } = await requireTeam();
  const parsed = await parseBillInput(input, team);
  if (!parsed.ok) return parsed;

  const [created] = await db
    .insert(fixedBills)
    .values({ ...parsed.values, teamId: team.id, userId: user.id })
    .returning({ id: fixedBills.id });

  revalidate();
  return { ok: true, id: created.id };
}

export async function updateFixedBill(
  id: string,
  input: FixedBillInput,
): Promise<ActionResult> {
  const session = await requireTeam();
  const bill = await findOwnBill(id, session);
  if (!bill) return NOT_FOUND;

  const parsed = await parseBillInput(input, session.team);
  if (!parsed.ok) return parsed;

  await db
    .update(fixedBills)
    .set(parsed.values)
    .where(
      and(
        eq(fixedBills.id, bill.id),
        eq(fixedBills.teamId, session.team.id),
        eq(fixedBills.userId, session.user.id),
      ),
    );

  revalidate();
  return { ok: true };
}

export async function setFixedBillActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const session = await requireTeam();
  const bill = await findOwnBill(id, session);
  if (!bill) return NOT_FOUND;

  await db
    .update(fixedBills)
    .set({ active: Boolean(active) })
    .where(
      and(
        eq(fixedBills.id, bill.id),
        eq(fixedBills.teamId, session.team.id),
        eq(fixedBills.userId, session.user.id),
      ),
    );

  revalidate();
  return { ok: true };
}

/** Borra el fijo y sus pagos (FK cascade). Los gastos vinculados quedan. */
export async function deleteFixedBill(id: string): Promise<ActionResult> {
  const session = await requireTeam();
  const bill = await findOwnBill(id, session);
  if (!bill) return NOT_FOUND;

  await db
    .delete(fixedBills)
    .where(
      and(
        eq(fixedBills.id, bill.id),
        eq(fixedBills.teamId, session.team.id),
        eq(fixedBills.userId, session.user.id),
      ),
    );

  revalidate();
  return { ok: true };
}

/**
 * Marca el fijo como pagado en el período. Con `createExpense`, además
 * registra el gasto y lo vincula.
 *
 * neon-http no tiene transacciones interactivas, así que la atomicidad se
 * logra por compensación: primero se inserta el pago (el UNIQUE(bill, period)
 * frena el doble marcado ANTES de crear ningún gasto), después el gasto y por
 * último se vincula. Si falla un paso, se deshacen los anteriores.
 */
export async function markFixedBillPaid(input: {
  billId: string;
  period: string; // "YYYY-MM-01" o "YYYY-MM"
  amount: string;
  paidOn: string; // "YYYY-MM-DD"
  createExpense: boolean;
  categoryId?: string | null; // para el gasto; si falta, la del fijo
}): Promise<ActionResult> {
  const session = await requireTeam();
  const { user, team } = session;
  const bill = await findOwnBill(input.billId, session);
  if (!bill) return NOT_FOUND;

  const period = normalizePeriod(input.period);
  if (!period) return { ok: false, error: "Mes inválido" };
  const cents = parseAmountToCents(String(input.amount ?? ""));
  if (cents === null || cents <= 0) return { ok: false, error: "Monto inválido" };
  if (!DATE_RE.test(input.paidOn ?? "")) return { ok: false, error: "Fecha inválida" };

  const withExpense = Boolean(input.createExpense);
  const categoryId = input.categoryId || bill.categoryId;
  let fxRate = 1;
  if (withExpense) {
    if (!categoryId)
      return { ok: false, error: "Elegí una categoría para registrarlo como gasto" };
    if (categoryId !== bill.categoryId) {
      if (!UUID_RE.test(categoryId)) return { ok: false, error: "Categoría inválida" };
      const [cat] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.id, categoryId),
            eq(categories.teamId, team.id),
            eq(categories.kind, "expense"),
          ),
        )
        .limit(1);
      if (!cat) return { ok: false, error: "Categoría inválida" };
    }
    const fx = await fxForMovement(team, bill.currency);
    if (fx.error) return { ok: false, error: fx.error };
    fxRate = fx.fxRate;
  }

  let paymentId: string;
  try {
    const [p] = await db
      .insert(fixedBillPayments)
      .values({
        billId: bill.id,
        period,
        amountCents: cents,
        currency: bill.currency,
        paidOn: input.paidOn,
        expenseId: null,
        createdExpense: false,
      })
      .returning({ id: fixedBillPayments.id });
    paymentId = p.id;
  } catch (err) {
    if (uniqueViolation(err) !== null) return { ok: false, error: ALREADY_PAID };
    console.error("markFixedBillPaid: insert payment", err);
    return { ok: false, error: "No se pudo marcar como pagado" };
  }

  if (withExpense && categoryId) {
    let expenseId: string | null = null;
    try {
      const created = await insertExpense(team.id, user.id, {
        amountCents: cents,
        currency: bill.currency,
        fxRate,
        categoryId,
        paymentMethod: bill.paymentMethod,
        description: bill.name,
        spentOn: input.paidOn,
        splitMode: "none",
      });
      expenseId = created.id;
      await db
        .update(fixedBillPayments)
        .set({ expenseId, createdExpense: true })
        .where(eq(fixedBillPayments.id, paymentId));
    } catch (err) {
      console.error("markFixedBillPaid: insert expense", err);
      // compensación: no dejar ni el gasto ni el pago a medias
      if (expenseId) {
        await bestEffort(
          db
            .delete(expenses)
            .where(and(eq(expenses.id, expenseId), eq(expenses.teamId, team.id))),
        );
      }
      await bestEffort(
        db.delete(fixedBillPayments).where(eq(fixedBillPayments.id, paymentId)),
      );
      return { ok: false, error: "No se pudo registrar el gasto" };
    }
  }

  revalidate(withExpense);
  return { ok: true };
}

/** Marca el fijo como pagado vinculándolo a un gasto existente del equipo. */
export async function linkFixedBillExpense(input: {
  billId: string;
  period: string;
  expenseId: string;
}): Promise<ActionResult> {
  const session = await requireTeam();
  const bill = await findOwnBill(input.billId, session);
  if (!bill) return NOT_FOUND;

  const period = normalizePeriod(input.period);
  if (!period) return { ok: false, error: "Mes inválido" };
  if (typeof input.expenseId !== "string" || !UUID_RE.test(input.expenseId))
    return { ok: false, error: "Gasto no encontrado" };

  const [exp] = await db
    .select({
      id: expenses.id,
      amountCents: expenses.amountCents,
      currency: expenses.currency,
      spentOn: expenses.spentOn,
    })
    .from(expenses)
    .where(and(eq(expenses.id, input.expenseId), eq(expenses.teamId, session.team.id)))
    .limit(1);
  if (!exp) return { ok: false, error: "Gasto no encontrado" };

  try {
    await db.insert(fixedBillPayments).values({
      billId: bill.id,
      period,
      amountCents: exp.amountCents,
      currency: exp.currency,
      paidOn: exp.spentOn,
      expenseId: exp.id,
      createdExpense: false,
    });
  } catch (err) {
    const constraint = uniqueViolation(err);
    if (constraint === "fixed_bill_payments_expense_idx")
      return { ok: false, error: EXPENSE_TAKEN };
    if (constraint !== null) return { ok: false, error: ALREADY_PAID };
    console.error("linkFixedBillExpense", err);
    return { ok: false, error: "No se pudo vincular el gasto" };
  }

  revalidate();
  return { ok: true };
}

/** Borra el pago del período. El gasto (creado o vinculado) NO se toca. */
export async function unmarkFixedBillPaid(input: {
  billId: string;
  period: string;
}): Promise<ActionResult> {
  const session = await requireTeam();
  const bill = await findOwnBill(input.billId, session);
  if (!bill) return NOT_FOUND;

  const period = normalizePeriod(input.period);
  if (!period) return { ok: false, error: "Mes inválido" };

  await db
    .delete(fixedBillPayments)
    .where(
      and(eq(fixedBillPayments.billId, bill.id), eq(fixedBillPayments.period, period)),
    );

  revalidate();
  return { ok: true };
}
