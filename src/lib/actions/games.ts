"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { gameRounds } from "@/db/schema";
import { requireTeam } from "@/lib/auth";

const GAMES = ["coin", "wheel", "finger", "dice"] as const;
type GameId = (typeof GAMES)[number];

/** Guarda el resultado de una ronda de "¿Quién invita hoy?" (solo log,
 *  para el historial — no afecta nada del resto de la app). */
export async function logGameRound(
  game: GameId,
  playerIds: string[],
  payerIds: string[],
): Promise<void> {
  const { team } = await requireTeam();
  if (
    !(GAMES as readonly string[]).includes(game) ||
    playerIds.length < 2 ||
    payerIds.length < 1
  ) {
    return;
  }

  await db.insert(gameRounds).values({ teamId: team.id, game, playerIds, payerIds });
  revalidatePath("/team");
}
