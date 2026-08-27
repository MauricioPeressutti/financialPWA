import { revalidatePath } from "next/cache";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  expenses,
  reimbursements,
  teamMembers,
  telegramLinks,
} from "@/db/schema";
import { insertExpense } from "@/lib/expenses-core";
import { parseExpenseMessage } from "@/lib/gemini";
import { formatCents } from "@/lib/money";
import {
  PAYMENT_METHODS,
  paymentMethodMeta,
  type PaymentMethod,
} from "@/lib/payment-methods";
import { getActiveCategories } from "@/lib/queries";
import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
  type TgUpdate,
} from "@/lib/telegram";

export const runtime = "nodejs";

const OK = () => new Response("ok");

const HELP = [
  "👋 <b>Finanzas</b>",
  "",
  "Escribí un gasto en lenguaje normal y lo cargo:",
  "· <i>5300 chino con débito</i>",
  "· <i>nafta 20 mil, tarjeta de crédito</i>",
  "· <i>super 8500 con mercado pago, me devolvieron 500</i>",
  "",
  "Después de cargar te dejo un botón para borrarlo si me equivoqué.",
].join("\n");

function today(): string {
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Argentina/Buenos_Aires",
    }),
  )
    .toISOString()
    .slice(0, 10);
}

const norm = (s: string) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join("")
    .trim();

async function linkedUser(telegramUserId: number) {
  const [row] = await db
    .select()
    .from(telegramLinks)
    .where(
      and(
        eq(telegramLinks.telegramUserId, String(telegramUserId)),
        isNotNull(telegramLinks.linkedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function teamOf(userId: string) {
  const [m] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .orderBy(teamMembers.createdAt)
    .limit(1);
  return m?.teamId ?? null;
}

export async function POST(req: Request) {
  if (
    req.headers.get("x-telegram-bot-api-secret-token") !==
    process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return new Response("forbidden", { status: 403 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return OK();
  }

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return OK();
    }

    const msg = update.message;
    if (!msg?.text || !msg.from) return OK();
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    // ── /start <code>  → vincular cuenta ──────────────────
    const startMatch = text.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{6,})/);
    if (startMatch) {
      const code = startMatch[1];
      const [link] = await db
        .select()
        .from(telegramLinks)
        .where(and(eq(telegramLinks.code, code), isNull(telegramLinks.linkedAt)))
        .limit(1);
      if (!link) {
        await sendMessage(
          chatId,
          "Ese código de vinculación no es válido o ya se usó. Generá uno nuevo desde la app (Equipo → Vincular Telegram).",
        );
        return OK();
      }
      await db
        .update(telegramLinks)
        .set({
          telegramUserId: String(msg.from.id),
          telegramChatId: String(chatId),
          linkedAt: new Date(),
        })
        .where(eq(telegramLinks.id, link.id));
      await sendMessage(
        chatId,
        "✅ <b>Cuenta vinculada.</b>\n\n" + HELP,
      );
      return OK();
    }

    if (/^\/(start|ayuda|help)\b/.test(text)) {
      await sendMessage(chatId, HELP);
      return OK();
    }

    // ── mensaje = gasto ──────────────────────────────────
    const link = await linkedUser(msg.from.id);
    if (!link) {
      await sendMessage(
        chatId,
        "Todavía no vinculaste tu cuenta. Abrí la app → <b>Equipo → Vincular Telegram</b> y seguí el link.",
      );
      return OK();
    }

    const teamId = await teamOf(link.userId);
    if (!teamId) {
      await sendMessage(chatId, "No encontré tu equipo. Entrá a la app primero.");
      return OK();
    }

    const cats = await getActiveCategories(teamId);
    const parsed = await parseExpenseMessage(text, {
      categories: cats.map((c) => ({
        name: c.name,
        subcategories: c.subcategories.map((s) => ({ name: s.name })),
      })),
      today: today(),
    });

    if (!parsed || parsed.amount === null || parsed.amount <= 0) {
      await sendMessage(
        chatId,
        "No pude sacar el monto. Probá algo como <i>“5000 super débito”</i>.",
      );
      return OK();
    }

    // resolver categoría
    let cat = cats.find((c) => norm(c.name) === norm(parsed.category));
    if (!cat && parsed.category)
      cat = cats.find((c) => norm(c.name).includes(norm(parsed.category)));
    if (!cat) cat = cats.find((c) => norm(c.name) === "otros") ?? cats[0];
    if (!cat) {
      await sendMessage(chatId, "El equipo no tiene categorías. Creá alguna en la app.");
      return OK();
    }
    const sub =
      cat.subcategories.find((s) => norm(s.name) === norm(parsed.subcategory)) ??
      null;

    const method: PaymentMethod = (
      PAYMENT_METHODS as readonly string[]
    ).includes(parsed.paymentMethod)
      ? (parsed.paymentMethod as PaymentMethod)
      : "efectivo";

    const amountCents = Math.round(parsed.amount * 100);
    const reimbursedCents =
      parsed.reimbursed > 0 ? Math.round(parsed.reimbursed * 100) : null;
    const spentOn = /^\d{4}-\d{2}-\d{2}$/.test(parsed.spentOn)
      ? parsed.spentOn
      : today();

    const { id } = await insertExpense(teamId, link.userId, {
      amountCents,
      categoryId: cat.id,
      subcategoryId: sub?.id ?? null,
      paymentMethod: method,
      description: parsed.description || null,
      spentOn,
      reimbursedCents,
    });

    revalidatePath("/");
    revalidatePath("/expenses");
    revalidatePath("/analytics");

    const lines = [
      `${parsed.confidence === "alta" ? "✅" : "⚠️"} <b>${formatCents(
        amountCents,
      )}</b> · ${cat.name}${sub ? ` · ${sub.name}` : ""} · ${
        paymentMethodMeta[method].label
      }`,
    ];
    if (reimbursedCents)
      lines.push(`↩️ reintegro ${formatCents(reimbursedCents)}`);
    if (parsed.description) lines.push(`<i>${parsed.description}</i>`);
    if (spentOn !== today()) lines.push(`📅 ${spentOn}`);
    if (parsed.confidence !== "alta" && parsed.note)
      lines.push(`\n<i>${parsed.note}</i>`);

    await sendMessage(chatId, lines.join("\n"), [
      [{ text: "🗑️ Borrar", callback_data: `del:${id}` }],
    ]);
  } catch (err) {
    console.error("telegram webhook error:", err);
    try {
      const chat =
        update.message?.chat.id ?? update.callback_query?.message?.chat.id;
      const detail =
        process.env.TELEGRAM_DEBUG === "1"
          ? `\n\n<code>${String(err instanceof Error ? err.message : err).slice(0, 400)}</code>`
          : "";
      if (chat)
        await sendMessage(
          chat,
          "Uf, algo falló procesando eso. Probá de nuevo." + detail,
        );
    } catch {}
  }

  return OK();
}

async function handleCallback(cq: NonNullable<TgUpdate["callback_query"]>) {
  const data = cq.data ?? "";
  const chatId = cq.message?.chat.id;
  const messageId = cq.message?.message_id;

  if (data.startsWith("del:") && chatId && messageId) {
    const expenseId = data.slice(4);
    const link = await linkedUser(cq.from.id);
    if (!link) {
      await answerCallbackQuery(cq.id, "No estás vinculado.");
      return;
    }
    const teamId = await teamOf(link.userId);
    const del = await db
      .delete(expenses)
      .where(
        and(eq(expenses.id, expenseId), eq(expenses.teamId, teamId ?? "")),
      )
      .returning({ id: expenses.id });
    if (del.length) {
      await db
        .delete(reimbursements)
        .where(eq(reimbursements.expenseId, expenseId));
      revalidatePath("/");
      revalidatePath("/expenses");
      await editMessageText(chatId, messageId, "🗑️ <s>Gasto borrado.</s>");
      await answerCallbackQuery(cq.id, "Borrado");
    } else {
      await answerCallbackQuery(cq.id, "Ese gasto ya no está.");
    }
    return;
  }
  await answerCallbackQuery(cq.id);
}
