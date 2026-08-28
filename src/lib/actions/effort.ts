"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { settlements, teamMembers } from "@/db/schema";
import { requireTeam } from "@/lib/auth";
import { getTeamBalance } from "@/lib/balance";
import { isCurrency } from "@/lib/currencies";
import { parseAmountToCents } from "@/lib/money";

type ActionResult = { ok: true } | { ok: false; error: string };

/** Cada persona configura su propio ingreso declarado. */
export async function setMyDeclaredIncome(input: {
  amount: string;
  currency: string;
}): Promise<ActionResult> {
  const { user, team } = await requireTeam();
  const cents = input.amount ? parseAmountToCents(input.amount) : 0;
  if (cents === null || cents < 0) return { ok: false, error: "Monto inválido" };
  const currency = isCurrency(input.currency) ? input.currency : "ARS";

  await db
    .update(teamMembers)
    .set({ declaredIncomeCents: cents, declaredIncomeCurrency: currency })
    .where(
      and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, user.id)),
    );

  revalidatePath("/team");
  revalidatePath("/esfuerzo");
  revalidatePath("/");
  return { ok: true };
}

/** Registra el pago que salda el balance en una moneda. */
export async function settleUp(input: {
  currency: string;
  note?: string;
}): Promise<ActionResult> {
  const { user, team } = await requireTeam();
  const currency = isCurrency(input.currency) ? input.currency : "ARS";

  const bal = await getTeamBalance(team.id, currency);
  if (!bal.suggestion)
    return { ok: false, error: "No hay nada para saldar." };

  await db.insert(settlements).values({
    teamId: team.id,
    fromUserId: bal.suggestion.fromUserId,
    toUserId: bal.suggestion.toUserId,
    amountCents: bal.suggestion.amountCents,
    currency,
    note: input.note?.trim() || null,
    settledOn: new Date().toISOString().slice(0, 10),
    createdByUserId: user.id,
  });

  revalidatePath("/esfuerzo");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteSettlement(id: string): Promise<ActionResult> {
  const { team } = await requireTeam();
  await db
    .delete(settlements)
    .where(and(eq(settlements.id, id), eq(settlements.teamId, team.id)));
  revalidatePath("/esfuerzo");
  revalidatePath("/");
  return { ok: true };
}
