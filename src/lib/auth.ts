import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { teamMembers, teams, users } from "@/db/schema";
import { verifySessionCookie } from "@/lib/firebase/admin";
import { ACTIVE_TEAM_COOKIE, SESSION_COOKIE_NAME } from "@/lib/session";

export { ACTIVE_TEAM_COOKIE };

export type SessionUser = typeof users.$inferSelect;
export type SessionTeam = typeof teams.$inferSelect & { role: "owner" | "member" };

/** Devuelve el usuario logueado (o null). Cacheado por request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;

  let firebaseUid: string;
  try {
    const decoded = await verifySessionCookie(cookie);
    firebaseUid = decoded.uid;
  } catch {
    return null;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, firebaseUid))
    .limit(1);

  return user ?? null;
});

/** Todos los equipos del usuario, con su rol. */
export const getUserTeams = cache(async (userId: string): Promise<SessionTeam[]> => {
  const rows = await db
    .select({ team: teams, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId));

  return rows.map((r) => ({ ...r.team, role: r.role }));
});

/** Equipo activo del usuario: el de la cookie si es válido, si no el primero. */
export const getActiveTeam = cache(async (): Promise<SessionTeam | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const teamsList = await getUserTeams(user.id);
  if (teamsList.length === 0) return null;

  const store = await cookies();
  const preferred = store.get(ACTIVE_TEAM_COOKIE)?.value;
  return teamsList.find((t) => t.id === preferred) ?? teamsList[0];
});

/** Lanza si no hay sesión o equipo. Usar en Server Actions / route handlers. */
export async function requireTeam(): Promise<{
  user: SessionUser;
  team: SessionTeam;
}> {
  const user = await getCurrentUser();
  if (!user) throw new Error("No autenticado");

  const team = await getActiveTeam();
  if (!team) throw new Error("Sin equipo activo");

  return { user, team };
}

/** Verifica que el usuario pertenezca a un equipo puntual (defensa multi-tenant). */
export async function assertMembership(userId: string, teamId: string) {
  const [row] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)))
    .limit(1);

  if (!row) throw new Error("Sin acceso a este equipo");
  return row.role;
}
