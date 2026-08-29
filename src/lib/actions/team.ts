"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { teamInvitations, teamMembers, teams } from "@/db/schema";
import {
  ACTIVE_TEAM_COOKIE,
  assertMembership,
  getCurrentUser,
  getUserTeams,
  requireTeam,
} from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/firebase/admin";
import { FX_REFERENCES, isCurrency } from "@/lib/currencies";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const INVITE_TTL_DAYS = 14;

/** Genera (o reusa) un link de invitación abierto. Solo owner. */
export async function createInviteLink(): Promise<ActionResult<{ url: string }>> {
  const { user, team } = await requireTeam();
  const role = await assertMembership(user.id, team.id);
  if (role !== "owner") return { ok: false, error: "Solo el owner puede invitar" };

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(teamInvitations).values({
    teamId: team.id,
    token,
    invitedByUserId: user.id,
    expiresAt,
  });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  revalidatePath("/team");
  return { ok: true, url: `${base}/join/${token}` };
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const { user, team } = await requireTeam();
  const role = await assertMembership(user.id, team.id);
  if (role !== "owner") return { ok: false, error: "Solo el owner puede hacer esto" };

  await db
    .update(teamInvitations)
    .set({ status: "revoked" })
    .where(and(eq(teamInvitations.id, id), eq(teamInvitations.teamId, team.id)));
  revalidatePath("/team");
  return { ok: true };
}

export async function leaveTeam(): Promise<ActionResult> {
  const { user, team } = await requireTeam();
  if (team.ownerUserId === user.id)
    return { ok: false, error: "El owner no puede salir del equipo" };

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, user.id)));

  const store = await cookies();
  store.delete(ACTIVE_TEAM_COOKIE);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Elimina el equipo entero (cascade: gastos, ingresos, categorías, objetivos…). Solo owner. */
export async function deleteTeam(confirmName: string): Promise<ActionResult> {
  const { user, team } = await requireTeam();
  const role = await assertMembership(user.id, team.id);
  if (role !== "owner")
    return { ok: false, error: "Solo el owner puede eliminar el equipo" };

  const myTeams = await getUserTeams(user.id);
  if (myTeams.length <= 1)
    return { ok: false, error: "Es tu único equipo, no lo podés eliminar" };

  if (confirmName.trim() !== team.name)
    return { ok: false, error: "El nombre no coincide" };

  await db.delete(teams).where(eq(teams.id, team.id));

  const store = await cookies();
  const other = myTeams.find((t) => t.id !== team.id);
  if (other) {
    store.set(ACTIVE_TEAM_COOKIE, other.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    store.delete(ACTIVE_TEAM_COOKIE);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<ActionResult> {
  const { user, team } = await requireTeam();
  const role = await assertMembership(user.id, team.id);
  if (role !== "owner") return { ok: false, error: "Solo el owner puede hacer esto" };
  if (userId === team.ownerUserId) return { ok: false, error: "No podés quitar al owner" };

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, userId)));
  revalidatePath("/team");
  return { ok: true };
}

export async function updateTeamCurrencies(input: {
  primaryCurrency: string;
  currencies: string[];
  fxReference: string;
}): Promise<ActionResult> {
  const { user, team } = await requireTeam();
  const role = await assertMembership(user.id, team.id);
  if (role !== "owner")
    return { ok: false, error: "Solo el owner puede cambiar esto" };

  const primary = isCurrency(input.primaryCurrency)
    ? input.primaryCurrency
    : "ARS";
  const list = Array.from(
    new Set([primary, ...input.currencies.filter(isCurrency)]),
  );
  const ref = (FX_REFERENCES as readonly string[]).includes(input.fxReference)
    ? input.fxReference
    : "blue";

  await db
    .update(teams)
    .set({ primaryCurrency: primary, currencies: list, fxReference: ref })
    .where(eq(teams.id, team.id));

  revalidatePath("/", "layout");
  revalidatePath("/team");
  return { ok: true };
}

export async function setEffortEnabled(
  enabled: boolean,
): Promise<ActionResult> {
  const { user, team } = await requireTeam();
  const role = await assertMembership(user.id, team.id);
  if (role !== "owner")
    return { ok: false, error: "Solo el owner puede cambiar esto" };

  await db
    .update(teams)
    .set({ effortEnabled: enabled })
    .where(eq(teams.id, team.id));

  revalidatePath("/", "layout");
  revalidatePath("/team");
  return { ok: true };
}

export async function setGoalsEnabled(
  enabled: boolean,
): Promise<ActionResult> {
  const { user, team } = await requireTeam();
  const role = await assertMembership(user.id, team.id);
  if (role !== "owner")
    return { ok: false, error: "Solo el owner puede cambiar esto" };

  await db
    .update(teams)
    .set({ goalsEnabled: enabled })
    .where(eq(teams.id, team.id));

  revalidatePath("/", "layout");
  revalidatePath("/team");
  return { ok: true };
}

export async function renameTeam(name: string): Promise<ActionResult> {
  const { user, team } = await requireTeam();
  const role = await assertMembership(user.id, team.id);
  if (role !== "owner") return { ok: false, error: "Solo el owner puede hacer esto" };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Nombre requerido" };

  await db.update(teams).set({ name: trimmed }).where(eq(teams.id, team.id));
  revalidatePath("/team");
  return { ok: true };
}

export async function switchTeam(teamId: string): Promise<ActionResult> {
  const { user } = await requireTeam();
  await assertMembership(user.id, teamId);
  const store = await cookies();
  store.set(ACTIVE_TEAM_COOKIE, teamId, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Acepta una invitación (el usuario ya tiene que estar logueado). */
export async function acceptInvitation(token: string): Promise<ActionResult<{ teamId: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const [invite] = await db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.token, token))
    .limit(1);

  if (!invite || invite.status !== "pending" || invite.expiresAt < new Date()) {
    return { ok: false, error: "Invitación inválida o vencida" };
  }

  await db
    .insert(teamMembers)
    .values({ teamId: invite.teamId, userId: user.id, role: invite.role })
    .onConflictDoNothing();

  // El link queda usado (el owner genera otro si necesita sumar a alguien más).
  await db
    .update(teamInvitations)
    .set({ status: "accepted" })
    .where(eq(teamInvitations.id, invite.id));

  const store = await cookies();
  store.set(ACTIVE_TEAM_COOKIE, invite.teamId, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  return { ok: true, teamId: invite.teamId };
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  store.delete(ACTIVE_TEAM_COOKIE);
}
