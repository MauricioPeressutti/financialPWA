import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import type { FirebaseToken } from "@/lib/firebase/admin";
import { categories, subcategories, teamMembers, teams, users } from "@/db/schema";

const DEFAULT_CATEGORIES: Record<string, string[]> = {
  Supermercado: ["Comida", "Limpieza", "Bebidas"],
  Hogar: ["Alquiler", "Expensas", "Servicios", "Muebles"],
  Transporte: ["Nafta", "SUBE", "Taxi/App", "Mantenimiento"],
  Salud: ["Farmacia", "Obra social", "Consultas"],
  Ocio: ["Salidas", "Streaming", "Viajes"],
  Otros: [],
};

/** Crea o actualiza el usuario a partir del token de Firebase. */
export async function upsertUserFromToken(token: FirebaseToken) {
  const values = {
    firebaseUid: token.uid,
    email: token.email ?? "",
    displayName: token.name ?? null,
    photoUrl: token.picture ?? null,
  };

  const [user] = await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({
      target: users.firebaseUid,
      set: { email: values.email, displayName: values.displayName, photoUrl: values.photoUrl },
    })
    .returning();

  return user;
}

/** Si el usuario no tiene equipo, le crea uno con categorías por defecto. */
export async function ensureTeam(userId: string) {
  const existing = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .limit(1);

  if (existing.length > 0) return existing[0].teamId;

  const [team] = await db
    .insert(teams)
    .values({ name: "Casa", ownerUserId: userId })
    .returning();

  await db.insert(teamMembers).values({ teamId: team.id, userId, role: "owner" });

  for (const [catName, subs] of Object.entries(DEFAULT_CATEGORIES)) {
    const [cat] = await db
      .insert(categories)
      .values({ teamId: team.id, name: catName })
      .returning();
    if (subs.length > 0) {
      await db
        .insert(subcategories)
        .values(subs.map((name) => ({ teamId: team.id, categoryId: cat.id, name })));
    }
  }

  return team.id;
}
