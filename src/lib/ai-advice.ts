import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import { aiInsights, categories, expenses, subcategories } from "@/db/schema";
import { geminiJson } from "@/lib/gemini";
import { formatMoney } from "@/lib/money";

export type AdviceKind = "alerta" | "ahorro" | "no_recurrente" | "positivo";
export type AdviceItem = {
  emoji: string;
  kind: AdviceKind;
  title: string;
  detail: string;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const n = (v: unknown) => Number(v ?? 0);

const SIGNALS_DAYS = 90;
const MAX_GROUPS = 35;
const MIN_GROUPS_TO_TRY = 3;

/** Gastos de los últimos SIGNALS_DAYS agrupados por categoría/subcategoría/
 *  descripción, para darle a la IA una foto compacta de en qué se gasta. */
async function getSpendSignals(teamId: string, currency: string) {
  const since = iso(new Date(Date.now() - SIGNALS_DAYS * 86400000));

  const rows = await db
    .select({
      category: categories.name,
      subcategory: subcategories.name,
      description: expenses.description,
      totalCents: sql<number>`sum(${expenses.amountCents})`,
      count: sql<number>`count(*)`,
      months: sql<number>`count(distinct to_char(${expenses.spentOn}, 'YYYY-MM'))`,
      lastSeen: sql<string>`max(${expenses.spentOn})`,
      avgCents: sql<number>`round(avg(${expenses.amountCents}))`,
    })
    .from(expenses)
    .innerJoin(categories, eq(categories.id, expenses.categoryId))
    .leftJoin(subcategories, eq(subcategories.id, expenses.subcategoryId))
    .where(
      and(
        eq(expenses.teamId, teamId),
        eq(expenses.currency, currency),
        gte(expenses.spentOn, since),
      ),
    )
    .groupBy(categories.name, subcategories.name, expenses.description)
    .orderBy(desc(sql`sum(${expenses.amountCents})`))
    .limit(MAX_GROUPS);

  return rows.map((r) => ({
    category: r.category,
    subcategory: r.subcategory ?? undefined,
    description: r.description || undefined,
    totalCents: n(r.totalCents),
    count: n(r.count),
    months: n(r.months),
    lastSeen: String(r.lastSeen),
    avgCents: n(r.avgCents),
  }));
}

type Signal = Awaited<ReturnType<typeof getSpendSignals>>[number];

function buildPrompt(signals: Signal[], currency: string, todayIso: string): string {
  const lines = signals
    .map((s) => {
      const label = [s.category, s.subcategory].filter(Boolean).join(" > ");
      const desc = s.description ? ` (${s.description})` : "";
      return `- ${label}${desc}: total ${formatMoney(s.totalCents, currency)} en ${s.count} mov., aparece en ${s.months} mes(es) distintos, último el ${s.lastSeen}, promedio ${formatMoney(s.avgCents, currency)}/mov.`;
    })
    .join("\n");

  return [
    "Sos un asesor financiero personal para una app de finanzas familiar en Argentina.",
    `Hoy es ${todayIso}. Vas a analizar los gastos de los últimos ${SIGNALS_DAYS} días (moneda ${currency}), ya agrupados por categoría, subcategoría y descripción.`,
    "",
    "Datos (cada línea: categoría > subcategoría (descripción): total gastado, cantidad de movimientos, en cuántos meses distintos aparece, fecha del último movimiento, promedio por movimiento):",
    lines,
    "",
    "Generá entre 3 y 6 consejos CONCRETOS y ACCIONABLES en español rioplatense, cada uno con:",
    '- kind="alerta": un gasto alto o que se repite mucho y probablemente sea recortable (delivery, salidas, suscripciones, etc).',
    '- kind="ahorro": una sugerencia puntual de dónde recortar, idealmente con el monto que se ahorraría.',
    '- kind="no_recurrente": un gasto grande que aparece en 1 solo mes/movimiento y probablemente NO se repita el mes que viene (para que no se asusten pensando que es un gasto fijo).',
    '- kind="positivo": algo que está bien encaminado (categoría bajo control, sin sorpresas).',
    "",
    "Reglas:",
    "- Usá SOLO los datos de la lista, no inventes categorías ni montos que no estén ahí.",
    "- No repitas la misma categoría en más de un ítem salvo que sea muy relevante.",
    "- Incluí al menos un kind=\"no_recurrente\" si hay algún gasto que aparece en 1 solo mes y es de los más grandes de la lista.",
    "- No es obligatorio usar los 4 kinds, pero sí variar (no des 6 alertas).",
    "- emoji: uno solo, relevante. title: 3-6 palabras. detail: una frase con el dato concreto (categoría y/o monto), máximo 160 caracteres.",
  ].join("\n");
}

const ADVICE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          emoji: { type: "string" },
          kind: {
            type: "string",
            enum: ["alerta", "ahorro", "no_recurrente", "positivo"],
          },
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["emoji", "kind", "title", "detail"],
      },
    },
  },
  required: ["items"],
};

async function getLatestCached(teamId: string, currency: string) {
  const [row] = await db
    .select()
    .from(aiInsights)
    .where(and(eq(aiInsights.teamId, teamId), eq(aiInsights.currency, currency)))
    .orderBy(desc(aiInsights.generatedOn))
    .limit(1);
  return row ?? null;
}

/**
 * Consejos de la IA sobre los gastos del equipo, cacheados 1 vez por día
 * (por equipo + moneda) para no gastar de más la cuota gratis de Gemini,
 * que se comparte con el bot de Telegram. Ver [[telegram-gemini-bot]].
 */
export async function getAiAdvice(
  teamId: string,
  currency: string,
): Promise<{ items: AdviceItem[]; generatedOn: string } | null> {
  const today = iso(new Date());

  const [todayRow] = await db
    .select()
    .from(aiInsights)
    .where(
      and(
        eq(aiInsights.teamId, teamId),
        eq(aiInsights.currency, currency),
        eq(aiInsights.generatedOn, today),
      ),
    )
    .limit(1);

  if (todayRow) {
    return { items: todayRow.items as AdviceItem[], generatedOn: String(todayRow.generatedOn) };
  }

  try {
    const signals = await getSpendSignals(teamId, currency);
    if (signals.length < MIN_GROUPS_TO_TRY) return null;

    const result = await geminiJson<{ items: AdviceItem[] }>(
      buildPrompt(signals, currency, today),
      [{ text: "Generá los consejos en el JSON pedido." }],
      ADVICE_SCHEMA,
      { tag: "ai-advice", temperature: 0.4 },
    );
    const items = (result?.items ?? []).slice(0, 6);
    if (items.length === 0) return null;

    await db
      .insert(aiInsights)
      .values({ teamId, currency, generatedOn: today, items })
      .onConflictDoUpdate({
        target: [aiInsights.teamId, aiInsights.currency, aiInsights.generatedOn],
        set: { items },
      });

    return { items, generatedOn: today };
  } catch (err) {
    console.error("ai-advice:", err);
    const stale = await getLatestCached(teamId, currency);
    if (stale) {
      return { items: stale.items as AdviceItem[], generatedOn: String(stale.generatedOn) };
    }
    return null;
  }
}
