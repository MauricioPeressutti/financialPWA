import { and, eq, gte, inArray, isNotNull, isNull, lte, ne, or } from "drizzle-orm";

import { db } from "@/db";
import { cardStatements, telegramLinks } from "@/db/schema";
import { formatMoney } from "@/lib/money";
import { sendMessage } from "@/lib/telegram";

export const runtime = "nodejs";

function today(): string {
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Argentina/Buenos_Aires",
    }),
  )
    .toISOString()
    .slice(0, 10);
}

/**
 * Cron diario (vercel.json): avisa por Telegram los resúmenes que vencen en ≤3 días.
 * Vercel manda `Authorization: Bearer <CRON_SECRET>` cuando la env var está seteada,
 * y además marca la request con el header `x-vercel-cron`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authed =
    !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
  if (!authed && !req.headers.has("x-vercel-cron")) {
    return new Response("forbidden", { status: 403 });
  }

  const t = today();
  const in3 = new Date(t + "T00:00:00");
  in3.setDate(in3.getDate() + 3);
  const limit = in3.toISOString().slice(0, 10);

  const rows = await db
    .select({
      id: cardStatements.id,
      label: cardStatements.label,
      dueDate: cardStatements.dueDate,
      totalArsCents: cardStatements.totalArsCents,
      minPaymentArsCents: cardStatements.minPaymentArsCents,
      chatId: telegramLinks.telegramChatId,
    })
    .from(cardStatements)
    .innerJoin(
      telegramLinks,
      and(
        eq(telegramLinks.userId, cardStatements.createdByUserId),
        isNotNull(telegramLinks.linkedAt),
        isNotNull(telegramLinks.telegramChatId),
      ),
    )
    .where(
      and(
        inArray(cardStatements.status, ["pending", "reminder_only", "imported"]),
        ne(cardStatements.status, "paid"),
        gte(cardStatements.dueDate, t),
        lte(cardStatements.dueDate, limit),
        or(
          isNull(cardStatements.remindedOn),
          ne(cardStatements.remindedOn, t),
        ),
      ),
    );

  let sent = 0;
  for (const r of rows) {
    if (!r.chatId) continue;

    const days = Math.round(
      (new Date(r.dueDate + "T00:00:00").getTime() -
        new Date(t + "T00:00:00").getTime()) /
        86400000,
    );
    const when =
      days <= 0
        ? "vence HOY"
        : days === 1
          ? "vence mañana"
          : `vence en ${days} días`;

    await sendMessage(
      r.chatId,
      `⚠️ <b>${r.label}</b> ${when}\nPagá ${formatMoney(r.totalArsCents, "ARS")}${
        r.minPaymentArsCents
          ? ` (mínimo ${formatMoney(r.minPaymentArsCents, "ARS")})`
          : ""
      }`,
      [[{ text: "💳 Ya la pagué", callback_data: `cardpaid:${r.id}` }]],
    );
    await db
      .update(cardStatements)
      .set({ remindedOn: t })
      .where(eq(cardStatements.id, r.id));
    sent++;
  }

  return Response.json({ ok: true, checked: rows.length, sent });
}
