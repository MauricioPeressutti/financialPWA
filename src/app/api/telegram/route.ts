import { revalidatePath } from "next/cache";
import { and, eq, isNotNull, isNull, lt } from "drizzle-orm";

import { db } from "@/db";
import {
  expenses,
  incomes,
  pendingMovements,
  reimbursements,
  teamMembers,
  teams,
  telegramLinks,
} from "@/db/schema";
import { isCurrency } from "@/lib/currencies";
import { insertExpense } from "@/lib/expenses-core";
import { insertIncome } from "@/lib/income-core";
import { fxForMovement } from "@/lib/fx";
import {
  parseExpenseMessage,
  parseReceiptImage,
  parseReceiptText,
  type ParsedMovement,
} from "@/lib/gemini";
import { extractPdfText } from "@/lib/pdf";
import { formatCents, formatMoney } from "@/lib/money";
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
import { normCat as norm, resolveCategory } from "@/lib/categories-resolve";
import { looksLikeStatement } from "@/lib/card-statement";
import { handleStatementPdf, markStatementPaidById } from "@/lib/card-statement-bot";
import {
  answerCallbackQuery,
  editMessageText,
  getTelegramFile,
  sendChatAction,
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
  "<b>📸 Sacale una foto al comprobante</b>",
  "Mandame la foto del ticket, la factura o la captura de la transferencia y lo cargo solo.",
  "Podés agregarle un texto de aclaración a la foto (ej: <i>“fue con la de crédito”</i>).",
  "",
  "<b>💳 Resumen de tarjeta de crédito</b>",
  "Mandame el PDF del resumen (de cualquier banco) y te aviso cuándo vence y cuánto,",
  "y te dejo un link para cargar los consumos sin duplicar los que ya tenías.",
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

type Cat = Awaited<ReturnType<typeof getActiveCategories>>[number];

type Btn = { text: string; callback_data: string };

/** Arma el texto de confirmación + teclado de un movimiento ya cargado. */
function renderMovement(a: {
  kind: "gasto" | "ingreso";
  id: string;
  confidence?: "alta" | "media" | "baja";
  amountCents: number;
  currency?: string;
  baseAmountCents?: number;
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
  const lowConf = a.confidence === "media" || a.confidence === "baja";
  const icon = lowConf
    ? "⚠️"
    : !a.method
      ? "🟡"
      : income
        ? "✅"
        : "🔻";
  const methodPart = a.method
    ? ` · ${meta[a.method].label}`
    : " · <i>¿con qué?</i>";

  const cur = a.currency || "ARS";
  const fmt = (c: number) => formatMoney(c, cur);
  const foreign = cur !== "ARS" && a.baseAmountCents != null;

  const lines = [
    `${icon} <b>${income ? "+" : "−"}${fmt(a.amountCents)}</b> · ${a.catName}${a.subName ? ` · ${a.subName}` : ""}${methodPart}`,
  ];
  if (foreign) lines.push(`≈ ${formatCents(a.baseAmountCents!)}`);
  if (a.reimbursedCents)
    lines.push(`↩️ reintegro ${fmt(a.reimbursedCents)}`);
  if (a.description) lines.push(`<i>${a.description}</i>`);
  if (a.on !== today()) lines.push(`📅 ${a.on}`);
  if (lowConf && a.note) lines.push(`\n<i>${a.note}</i>`);

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

type Commit = { text: string; keyboard: Btn[][] } | { errorMsg: string };

/** Crea el gasto/ingreso a partir de un parseo y devuelve el mensaje a mostrar. */
async function commitMovement(
  teamId: string,
  userId: string,
  kind: "gasto" | "ingreso",
  p: ParsedMovement,
  expCats: Cat[],
  incCats: Cat[],
): Promise<Commit> {
  const amountCents = Math.round((p.amount ?? 0) * 100);
  const on = /^\d{4}-\d{2}-\d{2}$/.test(p.spentOn) ? p.spentOn : today();
  const rev = () => {
    revalidatePath("/");
    revalidatePath("/movimientos");
    revalidatePath("/analytics");
  };

  // moneda + tipo de cambio
  const currency = isCurrency(p.currency) ? p.currency : "ARS";
  const [teamRow] = await db
    .select({
      primaryCurrency: teams.primaryCurrency,
      fxReference: teams.fxReference,
    })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  const primary = teamRow?.primaryCurrency ?? "ARS";
  const fx = await fxForMovement(
    { primaryCurrency: primary, fxReference: teamRow?.fxReference ?? "blue" },
    currency,
  );
  const fxRate = fx.error ? 1 : fx.fxRate;
  const baseAmountCents = Math.round(amountCents * fxRate);

  if (kind === "ingreso") {
    const cat = resolveCategory(incCats, p.category);
    if (!cat)
      return {
        errorMsg:
          "No tenés fuentes de ingreso cargadas. Creá alguna en la app (Categorías → Ingresos).",
      };
    const sub =
      cat.subcategories.find((s) => norm(s.name) === norm(p.subcategory)) ?? null;
    const stated = (INCOME_METHODS as readonly string[]).includes(
      p.paymentMethod,
    );
    const method: IncomeMethod = stated
      ? (p.paymentMethod as IncomeMethod)
      : "transferencia";
    const { id } = await insertIncome(teamId, userId, {
      amountCents,
      currency,
      fxRate,
      categoryId: cat.id,
      subcategoryId: sub?.id ?? null,
      method,
      description: p.description || null,
      receivedOn: on,
    });
    rev();
    return renderMovement({
      kind: "ingreso",
      id,
      confidence: p.confidence,
      amountCents,
      currency,
      baseAmountCents,
      catName: cat.name,
      subName: sub?.name ?? null,
      method: stated ? method : null,
      reimbursedCents: null,
      description: p.description || null,
      on,
      note: p.note,
    });
  }

  const cat = resolveCategory(expCats, p.category);
  if (!cat)
    return { errorMsg: "El equipo no tiene categorías. Creá alguna en la app." };
  const sub =
    cat.subcategories.find((s) => norm(s.name) === norm(p.subcategory)) ?? null;
  const stated = (PAYMENT_METHODS as readonly string[]).includes(p.paymentMethod);
  const method: PaymentMethod = stated
    ? (p.paymentMethod as PaymentMethod)
    : "efectivo";
  const reimbursedCents =
    p.reimbursed > 0 ? Math.round(p.reimbursed * 100) : null;
  const { id } = await insertExpense(teamId, userId, {
    amountCents,
    currency,
    fxRate,
    categoryId: cat.id,
    subcategoryId: sub?.id ?? null,
    paymentMethod: method,
    description: p.description || null,
    spentOn: on,
    reimbursedCents,
  });
  rev();
  return renderMovement({
    kind: "gasto",
    id,
    confidence: p.confidence,
    amountCents,
    currency,
    baseAmountCents,
    catName: cat.name,
    subName: sub?.name ?? null,
    method: stated ? method : null,
    reimbursedCents,
    description: p.description || null,
    on,
    note: p.note,
  });
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
    if (!msg?.from) return OK();
    const chatId = msg.chat.id;
    const text = msg.text?.trim() ?? "";

    const photo = msg.photo?.length ? msg.photo[msg.photo.length - 1] : null;
    const doc =
      msg.document &&
      /^(image\/|application\/pdf)/.test(msg.document.mime_type ?? "")
        ? msg.document
        : null;
    const fileId = photo?.file_id ?? doc?.file_id ?? null;

    if (!text && !fileId) return OK();

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

    const parseOpts = {
      expenseCategories: toTree(expCats),
      incomeCategories: toTree(incCats),
      today: today(),
    };

    const caption = msg.caption?.trim();
    let parsed: ParsedMovement | null;
    if (fileId) {
      await sendChatAction(chatId, "typing");
      const file = await getTelegramFile(fileId);
      if (!file) {
        await sendMessage(
          chatId,
          "No pude bajar el archivo (¿muy pesado?). Sacá una foto más liviana o cargalo por texto.",
        );
        return OK();
      }
      const isPdf =
        file.mimeType === "application/pdf" ||
        doc?.mime_type === "application/pdf" ||
        /\.pdf$/i.test(doc?.file_name ?? "");
      const pdfText = isPdf
        ? await extractPdfText(Buffer.from(file.base64, "base64"))
        : "";
      console.log("[tg] file", {
        docMime: doc?.mime_type,
        fileMime: file.mimeType,
        isPdf,
        pdfChars: pdfText.length,
      });

      // ¿Es un resumen de tarjeta y no un comprobante suelto?
      if (pdfText.length > 400 && looksLikeStatement(pdfText)) {
        await handleStatementPdf({
          chatId,
          teamId,
          userId: link.userId,
          pdfText,
          expenseCategories: parseOpts.expenseCategories,
          today: parseOpts.today,
        });
        return OK();
      }

      if (pdfText.length > 15) {
        parsed = await parseReceiptText(pdfText, { ...parseOpts, caption });
      } else {
        parsed = await parseReceiptImage({ ...file, caption }, parseOpts);
      }
    } else {
      parsed = await parseExpenseMessage(text, parseOpts);
    }

    if (!parsed || parsed.amount === null || parsed.amount <= 0) {
      await sendMessage(
        chatId,
        fileId
          ? "No pude leer el total del comprobante. Probá con una foto más nítida, o escribime el gasto."
          : "No pude sacar el monto. Probá algo como <i>“5000 super débito”</i> o <i>“cobré 30000 por transferencia”</i>.",
      );
      return OK();
    }

    const amountCents = Math.round(parsed.amount * 100);

    // ── no se entiende si es gasto o ingreso → preguntar ──
    if (!parsed.kindClear) {
      await db
        .delete(pendingMovements)
        .where(
          lt(pendingMovements.createdAt, new Date(Date.now() - 2 * 86400000)),
        );
      const [p] = await db
        .insert(pendingMovements)
        .values({ teamId, userId: link.userId, payload: parsed })
        .returning({ id: pendingMovements.id });
      await sendMessage(
        chatId,
        `🤔 <b>${formatMoney(amountCents, parsed.currency)}</b>${
          parsed.description ? ` · ${parsed.description}` : ""
        }\n¿Fue un <b>gasto</b> o un <b>ingreso</b>?`,
        [
          [
            { text: "🔻 Gasto", callback_data: `pk:${p.id}:gasto` },
            { text: "💰 Ingreso", callback_data: `pk:${p.id}:ingreso` },
          ],
        ],
      );
      return OK();
    }

    const res = await commitMovement(
      teamId,
      link.userId,
      parsed.kind,
      parsed,
      expCats,
      incCats,
    );
    if ("errorMsg" in res) {
      await sendMessage(chatId, res.errorMsg);
      return OK();
    }
    await sendMessage(chatId, res.text, res.keyboard);
  } catch (err) {
    console.error("telegram webhook error:", err);
    try {
      const chat =
        update.message?.chat.id ?? update.callback_query?.message?.chat.id;
      const msg = String(err instanceof Error ? err.message : err);
      const saturated = /saturad|503|429|UNAVAILABLE|high demand/i.test(msg);
      const detail =
        process.env.TELEGRAM_DEBUG === "1" && !saturated
          ? `\n\n<code>${msg.slice(0, 400)}</code>`
          : "";
      if (chat)
        await sendMessage(
          chat,
          saturated
            ? "⏳ El servicio está saturado por un ratito. Reenviame el mensaje en un minuto y lo cargo 🙏"
            : "Uf, algo falló procesando eso. Probá de nuevo." + detail,
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

  // ── resumen de tarjeta: "ya la pagué" / "solo recordar" / "descartar" ──
  if (
    data.startsWith("cardpaid:") ||
    data.startsWith("cardremind:") ||
    data.startsWith("carddismiss:")
  ) {
    const [action, id] = data.split(":");
    const msg = await markStatementPaidById(teamId, id, action);
    await editMessageText(chatId, messageId, msg);
    await answerCallbackQuery(cq.id, "Listo");
    return;
  }

  // ── responder "¿gasto o ingreso?" ──
  if (data.startsWith("pk:")) {
    const [, pid, k] = data.split(":");
    const kind = k === "ingreso" ? "ingreso" : "gasto";
    const [pend] = await db
      .select()
      .from(pendingMovements)
      .where(
        and(
          eq(pendingMovements.id, pid),
          eq(pendingMovements.userId, link.userId),
        ),
      )
      .limit(1);
    if (!pend) {
      await answerCallbackQuery(cq.id, "Ese movimiento ya se cargó o venció.");
      return;
    }
    const [expCats, incCats] = await Promise.all([
      getActiveCategories(pend.teamId, "expense"),
      getActiveCategories(pend.teamId, "income"),
    ]);
    const res = await commitMovement(
      pend.teamId,
      link.userId,
      kind,
      pend.payload as ParsedMovement,
      expCats,
      incCats,
    );
    await db.delete(pendingMovements).where(eq(pendingMovements.id, pid));
    if ("errorMsg" in res) {
      await editMessageText(chatId, messageId, res.errorMsg);
    } else {
      await editMessageText(chatId, messageId, res.text, res.keyboard);
    }
    await answerCallbackQuery(cq.id, kind === "ingreso" ? "Ingreso" : "Gasto");
    return;
  }

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
          currency: row.currency,
          baseAmountCents: row.baseAmountCents,
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
          currency: row.currency,
          baseAmountCents: row.baseAmountCents,
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
