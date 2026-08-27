"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { categories, subcategories } from "@/db/schema";
import { requireTeam } from "@/lib/auth";
import { categoryInput, subcategoryInput } from "@/lib/validation";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function createCategory(raw: unknown): Promise<ActionResult> {
  const { team } = await requireTeam();
  const parsed = categoryInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await db.insert(categories).values({ teamId: team.id, name: parsed.data.name.trim() });
  revalidatePath("/categories");
  return { ok: true };
}

export async function createSubcategory(raw: unknown): Promise<ActionResult> {
  const { team } = await requireTeam();
  const parsed = subcategoryInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, parsed.data.categoryId), eq(categories.teamId, team.id)))
    .limit(1);
  if (!cat) return { ok: false, error: "Categoría inválida" };

  await db.insert(subcategories).values({
    teamId: team.id,
    categoryId: parsed.data.categoryId,
    name: parsed.data.name.trim(),
  });
  revalidatePath("/categories");
  return { ok: true };
}

export async function setCategoryArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const { team } = await requireTeam();
  await db
    .update(categories)
    .set({ archived })
    .where(and(eq(categories.id, id), eq(categories.teamId, team.id)));
  revalidatePath("/categories");
  return { ok: true };
}

export async function setSubcategoryArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const { team } = await requireTeam();
  await db
    .update(subcategories)
    .set({ archived })
    .where(and(eq(subcategories.id, id), eq(subcategories.teamId, team.id)));
  revalidatePath("/categories");
  return { ok: true };
}
