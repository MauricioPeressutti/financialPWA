import { revalidatePath } from "next/cache";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  expenses,
  incomes,
  reimbursements,
  teamMembers,
  telegramLinks,
} from "@/db/schema";
import { insertExpense } from "@/lib/expenses-core";
import { insertIncome } from "@/lib/income-core";
import { parseExpenseMessage } from "@/lib/gemini";
import { formatCents } from "@/lib/money";
import {
  PAYMENT_METHODS,
  paymentMethodMeta,
  type PaymentMethod,
} from "@/lib/payment-methods";
import {
  INCOME_METHODS,
  incomeMethodMeta,
  type IncomeMethod,
} from "@/lib/income-methods";
import { getActiveCategories, getExpense, getIncome } from "@/lib/queries";
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
  "Escribime en lenguaje normal y lo cargo. No hace falta un formato: poné el monto y lo que quieras aclarar.",
  "",
  "<b>💸 Para un gasto</b>",
  "· <i>5300 en el chino con débito</i>",
  "· <i>nafta 20 mil, tarjeta de crédito</i>",
  "· <i>farmacia 8500 con mercado pago</i>",
  "· <i>super 12000 en efectivo, me devolvieron 2000</i>  (queda el reintegro)",
  "· <i>ayer pagué 15 lucas de la luz</i>  (podés poner la fecha)",
  "",
  "<b>💰 Para un ingreso</b>",
  "· <i>cobré el sueldo, 900 mil por transferencia</i>",
  "· <i>vendí una torta, entraron 15000 en efectivo</i>",
  "· <i>me depositaron 50 mil de un freelance</i>",
  "",
  "Yo saco solo el monto, la categoría, la forma de pago y la fecha. Si algo no me queda claro te aviso.",
  "Después de cada carga te dejo un botón <b>🗑️ Borrar</b> por si me equivoqué.",
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

type Cat = Awaited<ReturnType<typeof getActiveCategories>>[number];

function resolveCategory(cats: Cat[], name: string) {
  let cat = cats.find((c) => norm(c.name) === norm(name));
  if (!cat && name)
    cat = cats.find((c) => norm(c.name).includes(norm(name)));
  if (!cat) cat = cats.find((c) => norm(c.name) === "otros") ?? cats[0];
  return cat ?? null;
}

type Btn = { text: string; callback_data: string };

/** Arma el texto de confirmación + teclado de un movimiento ya cargado. */
function renderMovement(a: {
  kind: "gasto" | "ingreso";
  id: string;
  confidence?: "alta" | "media" | "baja";
  amountCents: number;
  catName: string;
  subName: string | null;
  method: string | null; // null = todavía sin elegir
  reimbursedCents: number | null;
  description: string | null;
  on: string;
  note?: string | null;
}): { text: string; keyboard: Btn[][] } {
  const income = a.kind === "ingreso";
  const meta = (
    income ? incomeMethodMeta : paymentMethodMeta
  ) as Record<string, { label: string }>;
  const conf =
    a.confidence === "media" || a.confidence === "baja"
      ? "⚠️"
      : a.method
        ? "✅"
        : "🟡";
  const methodPart = a.method
    ? ` · ${meta[a.method].label}`
    : " · <i>¿con qué?</i>";

  const lines = [
    `${conf} ${income ? "💰 " : ""}<b>${income ? "+" : ""}${formatCents(a.amountCents)}</b> · ${a.catName}${a.subName ? ` · ${a.subName}` : ""}${methodPart}`,
  ];
  if (a.reimbursedCents)
    lines.push(`↩️ reintegro ${formatCents(a.reimbursedCents)}`);
  if (a.description) lines.push(`<i>${a.description}</i>`);
  if (a.on !== today()) lines.push(`📅 ${a.on}`);
  if ((a.confidence === "media" || a.confidence === "baja") && a.note)
    lines.push(`\n<i>${a.note}</i>`);

  const kb: Btn[][] = [];
  if (!a.method) {
    const methods = income ? INCOME_METHODS : PAYMENT_METHODS;
    const prefix = income ? "seti" : "setm";
    let row: Btn[] = [];
    for (const m of methods) {
      row.push({ text: meta[m].label, callback_data: `${prefix}:${a.id}:${m}` });
      if (row.length === 2) {
        kb.push(row);
        row = [];
      }
    }
    if (row.length) kb.push(row);
  }
  kb.push([
    { text: "🗑️ Borrar", callback_data: `${income ? "dinc" : "del"}:${a.id}` },
  ]);
  return { text: lines.join("\n"), keyboard: kb };
}

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
      await sendMessage(chatId, "✅ <b>Cuenta vinculada.</b>\n\n" + HELP);
      return OK();
    }

    if (/^\/(start|ayuda|help)\b/.test(text)) {
      await sendMessage(chatId, HELP);
      return OK();
    }

    // ── mensaje = movimiento ─────────────────────────────
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

    const [expCats, incCats] = await Promise.all([
      getActiveCategories(teamId, "expense"),
      getActiveCategories(teamId, "income"),
    ]);

    const toTree = (cs: Cat[]) =>
      cs.map((c) => ({
        name: c.name,
        subcategories: c.subcategories.map((s) => ({ name: s.name })),
      }));

    const parsed = await parseExpenseMessage(text, {
      expenseCategories: toTree(expCats),
      incomeCategories: toTree(incCats),
      today: today(),
    });

    if (!parsed || parsed.amount === null || parsed.amount <= 0) {
      await sendMessage(
        chatId,
        "No pude sacar el monto. Probá algo como <i>“5000 super débito”</i> o <i>“cobré 30000 por transferencia”</i>.",
      );
      return OK();
    }

    const amountCents = Math.round(parsed.amount * 100);
    const on = /^\d{4}-\d{2}-\d{2}$/.test(parsed.spentOn)
      ? parsed.spentOn
      : today();

    const revalidate = () => {
      revalidatePath("/");
      revalidatePath("/movimientos");
      revalidatePath("/analytics");
    };

    if (parsed.kind === "ingreso") {
      const cat = resolveCategory(incCats, parsed.category);
      if (!cat) {
        await sendMessage(
          chatId,
          "No tenés fuentes de ingreso cargadas. Creá alguna en la app (Categorías → Ingresos).",
        );
        return OK();
      }
      const sub =
        cat.subcategories.find((s) => norm(s.name) === norm(parsed.subcategory)) ??
        null;
      const stated = (INCOME_METHODS as readonly string[]).includes(
        parsed.paymentMethod,
      );
      const method: IncomeMethod = stated
        ? (parsed.paymentMethod as IncomeMethod)
        : "transferencia"; // provisorio hasta que elija

      const { id } = await insertIncome(teamId, link.userId, {
        amountCents,
        categoryId: cat.id,
        subcategoryId: sub?.id ?? null,
        method,
        description: parsed.description || null,
        receivedOn: on,
      });
      revalidate();

      const rm = renderMovement({
        kind: "ingreso",
        id,
        confidence: parsed.confidence,
        amountCents,
        catName: cat.name,
        subName: sub?.name ?? null,
        method: stated ? method : null,
        reimbursedCents: null,
        description: parsed.description || null,
        on,
        note: parsed.note,
      });
      await sendMessage(chatId, rm.text, rm.keyboard);
      return OK();
    }

    // gasto
    const cat = resolveCategory(expCats, parsed.category);
    if (!cat) {
      await sendMessage(
        chatId,
        "El equipo no tiene categorías. Creá alguna en la app.",
      );
      return OK();
    }
    const sub =
      cat.subcategories.find((s) => norm(s.name) === norm(parsed.subcategory)) ??
      null;
    const stated = (PAYMENT_METHODS as readonly string[]).includes(
      parsed.paymentMethod,
    );
    const method: PaymentMethod = stated
      ? (parsed.paymentMethod as PaymentMethod)
      : "efectivo"; // provisorio hasta que elija
    const reimbursedCents =
      parsed.reimbursed > 0 ? Math.round(parsed.reimbursed * 100) : null;

    const { id } = await insertExpense(teamId, link.userId, {
      amountCents,
      categoryId: cat.id,
      subcategoryId: sub?.id ?? null,
      paymentMethod: method,
      description: parsed.description || null,
      spentOn: on,
      reimbursedCents,
    });
    revalidate();

    const rm = renderMovement({
      kind: "gasto",
      id,
      confidence: parsed.confidence,
      amountCents,
      catName: cat.name,
      subName: sub?.name ?? null,
      method: stated ? method : null,
      reimbursedCents,
      description: parsed.description || null,
      on,
      note: parsed.note,
    });
    await sendMessage(chatId, rm.text, rm.keyboard);
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
  if (!chatId || !messageId) {
    await answerCallbackQuery(cq.id);
    return;
  }

  const link = await linkedUser(cq.from.id);
  if (!link) {
    await answerCallbackQuery(cq.id, "No estás vinculado.");
    return;
  }
  const teamId = (await teamOf(link.userId)) ?? "";

  // ── elegir forma de pago / medio de un movimiento recién cargado ──
  if (data.startsWith("setm:") || data.startsWith("seti:")) {
    const income = data.startsWith("seti:");
    const [, mid, m] = data.split(":");
    const valid = (
      income ? INCOME_METHODS : PAYMENT_METHODS
    ) as readonly string[];
    if (!valid.includes(m)) {
      await answerCallbackQuery(cq.id);
      return;
    }
    if (income) {
      const upd = await db
        .update(incomes)
        .set({ method: m as IncomeMethod, updatedAt: new Date() })
        .where(and(eq(incomes.id, mid), eq(incomes.teamId, teamId)))
        .returning({ id: incomes.id });
      if (!upd.length) {
        await answerCallbackQuery(cq.id, "Ese ingreso ya no está.");
        return;
      }
      const row = await getIncome(teamId, mid);
      if (row) {
        const { text, keyboard } = renderMovement({
          kind: "ingreso",
          id: mid,
          amountCents: row.amountCents,
          catName: row.categoryName,
          subName: row.subcategoryName,
          method: row.method,
          reimbursedCents: null,
          description: row.description,
          on: String(row.receivedOn),
        });
        await editMessageText(chatId, messageId, text, keyboard);
      }
    } else {
      const upd = await db
        .update(expenses)
        .set({ paymentMethod: m as PaymentMethod, updatedAt: new Date() })
        .where(and(eq(expenses.id, mid), eq(expenses.teamId, teamId)))
        .returning({ id: expenses.id });
      if (!upd.length) {
        await answerCallbackQuery(cq.id, "Ese gasto ya no está.");
        return;
      }
      const row = await getExpense(teamId, mid);
      if (row) {
        const reimb = row.reimbursements.reduce((s, r) => s + r.amountCents, 0);
        const { text, keyboard } = renderMovement({
          kind: "gasto",
          id: mid,
          amountCents: row.amountCents,
          catName: row.categoryName,
          subName: row.subcategoryName,
          method: row.paymentMethod,
          reimbursedCents: reimb || null,
          description: row.description,
          on: String(row.spentOn),
        });
        await editMessageText(chatId, messageId, text, keyboard);
      }
    }
    revalidatePath("/");
    revalidatePath("/movimientos");
    revalidatePath("/analytics");
    await answerCallbackQuery(cq.id, "Listo");
    return;
  }

  const isIncome = data.startsWith("dinc:");
  const isExpense = data.startsWith("del:");
  if (!isIncome && !isExpense) {
    await answerCallbackQuery(cq.id);
    return;
  }

  const id = data.slice(data.indexOf(":") + 1);

  if (isIncome) {
    const del = await db
      .delete(incomes)
      .where(and(eq(incomes.id, id), eq(incomes.teamId, teamId)))
      .returning({ id: incomes.id });
    if (del.length) {
      revalidatePath("/");
      revalidatePath("/movimientos");
      revalidatePath("/analytics");
      await editMessageText(chatId, messageId, "🗑️ <s>Ingreso borrado.</s>");
      await answerCallbackQuery(cq.id, "Borrado");
    } else {
      await answerCallbackQuery(cq.id, "Ese ingreso ya no está.");
    }
    return;
  }

  const del = await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.teamId, teamId)))
    .returning({ id: expenses.id });
  if (del.length) {
    await db.delete(reimbursements).where(eq(reimbursements.expenseId, id));
    revalidatePath("/");
    revalidatePath("/movimientos");
    revalidatePath("/analytics");
    await editMessageText(chatId, messageId, "🗑️ <s>Gasto borrado.</s>");
    await answerCallbackQuery(cq.id, "Borrado");
  } else {
    await answerCallbackQuery(cq.id, "Ese gasto ya no está.");
  }
}
