"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { incomes } from "@/db/schema";
import { requireTeam } from "@/lib/auth";
import { normalizeEntity } from "@/lib/entities";
import { insertIncome } from "@/lib/income-core";
import { fxForMovement } from "@/lib/fx";
import { parseAmountToCents } from "@/lib/money";
import { incomeInput } from "@/lib/validation";

type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/");
  revalidatePath("/movimientos");
  revalidatePath("/analytics");
}

export async function createIncome(raw: unknown): Promise<ActionResult> {
  const { user, team } = await requireTeam();
  const parsed = incomeInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const cents = parseAmountToCents(parsed.data.amount);
  if (cents === null || cents === 0) return { ok: false, error: "Monto inválido" };

  const fx = await fxForMovement(team, parsed.data.currency, parsed.data.fxRate);
  if (fx.error) return { ok: false, error: fx.error };

  await insertIncome(team.id, user.id, {
    amountCents: cents,
    currency: parsed.data.currency,
    fxRate: fx.fxRate,
    categoryId: parsed.data.categoryId,
    subcategoryId: parsed.data.subcategoryId || null,
    method: parsed.data.method,
    entity: parsed.data.entity || null,
    description: parsed.data.description || null,
    receivedOn: parsed.data.receivedOn,
  });

  revalidate();
  return { ok: true };
}

export async function updateIncome(id: string, raw: unknown): Promise<ActionResult> {
  const { team } = await requireTeam();
  const parsed = incomeInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const cents = parseAmountToCents(parsed.data.amount);
  if (cents === null || cents === 0) return { ok: false, error: "Monto inválido" };

  const fx = await fxForMovement(team, parsed.data.currency, parsed.data.fxRate);
  if (fx.error) return { ok: false, error: fx.error };

  const updated = await db
    .update(incomes)
    .set({
      amountCents: cents,
      currency: parsed.data.currency,
      fxRate: fx.fxRate,
      baseAmountCents: Math.round(cents * fx.fxRate),
      categoryId: parsed.data.categoryId,
      subcategoryId: parsed.data.subcategoryId || null,
      method: parsed.data.method,
      entity: normalizeEntity(parsed.data.entity),
      description: parsed.data.description || null,
      receivedOn: parsed.data.receivedOn,
      updatedAt: new Date(),
    })
    .where(and(eq(incomes.id, id), eq(incomes.teamId, team.id)))
    .returning({ id: incomes.id });

  if (updated.length === 0) return { ok: false, error: "Ingreso no encontrado" };

  revalidate();
  revalidatePath(`/incomes/${id}`);
  return { ok: true };
}

export async function deleteIncome(id: string): Promise<ActionResult> {
  const { team } = await requireTeam();
  await db
    .delete(incomes)
    .where(and(eq(incomes.id, id), eq(incomes.teamId, team.id)));
  revalidate();
  return { ok: true };
}
