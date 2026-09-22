import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { gameRounds } from "@/db/schema";

export type GameStats = Record<string, { played: number; paid: number }>;

/** Cuántas rondas jugó y cuántas veces pagó cada usuario del equipo,
 *  para el historial de "¿Quién invita hoy?". */
export async function getGameStats(teamId: string): Promise<GameStats> {
  const rows = await db
    .select({ playerIds: gameRounds.playerIds, payerIds: gameRounds.payerIds })
    .from(gameRounds)
    .where(eq(gameRounds.teamId, teamId))
    .orderBy(desc(gameRounds.playedAt))
    .limit(500);

  const stats: GameStats = {};
  const bump = (id: string, key: "played" | "paid") => {
    stats[id] ??= { played: 0, paid: 0 };
    stats[id][key]++;
  };
  for (const r of rows) {
    for (const id of r.playerIds as string[]) bump(id, "played");
    for (const id of r.payerIds as string[]) bump(id, "paid");
  }
  return stats;
}
