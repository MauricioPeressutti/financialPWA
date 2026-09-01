import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { cardStatements } from "@/db/schema";
import {
  parseCardStatement,
  statementLabel,
  type CategoryTree,
} from "@/lib/card-statement";
import { findDuplicateStatement } from "@/lib/card-statements";
import { formatMoney } from "@/lib/money";
import { sendMessage } from "@/lib/telegram";

function appUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

type HandleArgs = {
  chatId: number | string;
  teamId: string;
  userId: string;
  pdfText: string;
  expenseCategories: CategoryTree;
  today: string;
};

/** Procesa el PDF de un resumen de tarjeta: parsea, guarda y responde con el resumen + botones. */
export async function handleStatementPdf(args: HandleArgs): Promise<void> {
  const { chatId, teamId, userId, pdfText, expenseCategories, today } = args;

  const parsed = await parseCardStatement(pdfText, { expenseCategories, today });

  if (!parsed || !parsed.dueDate) {
    await sendMessage(
      chatId,
      "Leí el PDF pero no pude sacar la fecha de vencimiento. ¿Es un resumen de tarjeta de crédito del homebanking? Mandámelo como PDF, no como foto.",
    );
    return;
  }

  const label = statementLabel(parsed);

  const dup = await findDuplicateStatement(
    teamId,
    parsed.bank,
    parsed.last4,
    parsed.closingDate,
  );
  if (dup) {
    await sendMessage(
      chatId,
      `Este resumen ya lo tenías cargado (${label}).\n${appUrl(
        `/tarjetas/${dup.id}/revisar`,
      )}`,
    );
    return;
  }

  const [row] = await db
    .insert(cardStatements)
    .values({
      teamId,
      createdByUserId: userId,
      bank: parsed.bank || null,
      brand: parsed.brand || null,
      last4: parsed.last4 || null,
      label,
      closingDate: parsed.closingDate,
      dueDate: parsed.dueDate,
      totalArsCents: parsed.totalArsCents,
      totalUsdCents: parsed.totalUsdCents,
      minPaymentArsCents: parsed.minPaymentArsCents,
      status: "pending",
      raw: parsed,
    })
    .returning({ id: cardStatements.id });

  const consumos = parsed.lines.filter(
    (l) => l.kind === "consumo" || l.kind === "cuota",
  ).length;

  const lines = [
    `💳 <b>${label}</b>`,
    parsed.closingDate
      ? `Cierre ${fmtDate(parsed.closingDate)} · Vence ${fmtDate(parsed.dueDate)}`
      : `Vence ${fmtDate(parsed.dueDate)}`,
    `Total: <b>${formatMoney(parsed.totalArsCents, "ARS")}</b>${
      parsed.totalUsdCents ? `  +  ${formatMoney(parsed.totalUsdCents, "USD")}` : ""
    }`,
    parsed.minPaymentArsCents
      ? `Mínimo: ${formatMoney(parsed.minPaymentArsCents, "ARS")}`
      : "",
    `${consumos} consumo${consumos === 1 ? "" : "s"} en el período`,
  ].filter(Boolean);

  await sendMessage(chatId, lines.join("\n"), [
    [
      {
        text: "📥 Revisar y cargar consumos",
        url: appUrl(`/tarjetas/${row.id}/revisar`),
      },
    ],
    [{ text: "🔔 Solo recordarme el vencimiento", callback_data: `cardremind:${row.id}` }],
    [{ text: "🗑️ Descartar", callback_data: `carddismiss:${row.id}` }],
  ]);
}

function fmtDate(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/** Callbacks de los botones del resumen. `action` ∈ cardpaid | cardremind | carddismiss */
export async function markStatementPaidById(
  teamId: string,
  id: string,
  action: string,
): Promise<string> {
  const where = and(eq(cardStatements.id, id), eq(cardStatements.teamId, teamId));

  if (action === "carddismiss") {
    await db.delete(cardStatements).where(where);
    return "🗑️ Resumen descartado.";
  }
  if (action === "cardremind") {
    await db.update(cardStatements).set({ status: "reminder_only" }).where(where);
    return "🔔 Listo. Te aviso cuando se acerque el vencimiento.";
  }
  // cardpaid
  await db.update(cardStatements).set({ status: "paid" }).where(where);
  return "✅ Marcado como pagado.";
}
