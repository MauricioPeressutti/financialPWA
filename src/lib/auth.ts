import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { expenses, incomes, teamMembers, teams, users } from "@/db/schema";
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

/** Todos los equipos del usuario, con su rol. Orden estable: por antigüedad de membresía. */
export const getUserTeams = cache(async (userId: string): Promise<SessionTeam[]> => {
  const rows = await db
    .select({ team: teams, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId))
    .orderBy(asc(teamMembers.createdAt));

  return rows.map((r) => ({ ...r.team, role: r.role }));
});

/** Último equipo donde la persona cargó un movimiento (para el fallback). */
async function lastActiveTeamId(userId: string): Promise<string | null> {
  const rows = await db
    .select({ teamId: sql<string>`team_id` })
    .from(
      sql`(
        select ${expenses.teamId} as team_id, max(${expenses.createdAt}) as last
          from ${expenses} where ${expenses.createdByUserId} = ${userId}
          group by ${expenses.teamId}
        union all
        select ${incomes.teamId} as team_id, max(${incomes.createdAt}) as last
          from ${incomes} where ${incomes.createdByUserId} = ${userId}
          group by ${incomes.teamId}
      ) t`,
    )
    .groupBy(sql`team_id`)
    .orderBy(sql`max(last) desc`)
    .limit(1);
  return rows[0]?.teamId ?? null;
}

/**
 * Equipo activo: el de la cookie si es válido; si no, el último donde cargaste
 * algo; y de última el más viejo. Así no caés al azar en un equipo vacío.
 */
export const getActiveTeam = cache(async (): Promise<SessionTeam | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const teamsList = await getUserTeams(user.id);
  if (teamsList.length === 0) return null;
  if (teamsList.length === 1) return teamsList[0];

  const store = await cookies();
  const preferred = store.get(ACTIVE_TEAM_COOKIE)?.value;
  const byCookie = teamsList.find((t) => t.id === preferred);
  if (byCookie) return byCookie;

  const lastActive = await lastActiveTeamId(user.id);
  const byActivity = teamsList.find((t) => t.id === lastActive);
  if (byActivity) return byActivity;

  // Sin señal de actividad: preferí un equipo al que te invitaron antes que
  // tu "Casa" personal (owner de un equipo vacío = casi siempre el auto-creado).
  return teamsList.find((t) => t.role === "member") ?? teamsList[0];
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
