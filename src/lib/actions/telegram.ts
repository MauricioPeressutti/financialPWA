"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { telegramLinks } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

function botUrl(code: string) {
  const bot = process.env.TELEGRAM_BOT_USERNAME ?? "";
  return bot ? `https://t.me/${bot}?start=${code}` : "";
}

/** Genera (o reusa) un código para vincular Telegram con la cuenta actual. */
export async function linkTelegram(): Promise<ActionResult<{ url: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const [existing] = await db
    .select()
    .from(telegramLinks)
    .where(eq(telegramLinks.userId, user.id))
    .limit(1);

  // Ya vinculado: no regeneramos.
  if (existing?.linkedAt) {
    return { ok: false, error: "Tu Telegram ya está vinculado." };
  }

  const code = randomBytes(9).toString("base64url");

  if (existing) {
    await db
      .update(telegramLinks)
      .set({ code, createdAt: new Date() })
      .where(eq(telegramLinks.id, existing.id));
  } else {
    await db.insert(telegramLinks).values({ userId: user.id, code });
  }

  const url = botUrl(code);
  if (!url) return { ok: false, error: "Falta configurar el bot (TELEGRAM_BOT_USERNAME)." };

  revalidatePath("/team");
  return { ok: true, url };
}

export async function unlinkTelegram(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };

  await db.delete(telegramLinks).where(eq(telegramLinks.userId, user.id));
  revalidatePath("/team");
  return { ok: true };
}
