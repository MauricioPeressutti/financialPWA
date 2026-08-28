import "server-only";

import { formatMoney } from "@/lib/money";
import { paymentMethodLabels } from "@/lib/payment-methods";
import type { Analytics, SpendPace } from "@/lib/analytics";

export type Insight = { emoji: string; text: string };

const DOW_FULL = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];

/** Frases automáticas a partir de los datos ya calculados. */
export function buildInsights(
  a: Analytics,
  pace: SpendPace,
  currency = "ARS",
): Insight[] {
  const out: Insight[] = [];
  const k = a.kpis;
  const formatCents = (c: number) => formatMoney(c, currency);

  if (a.byCategory[0] && k.grossCents) {
    const c = a.byCategory[0];
    out.push({
      emoji: "🎯",
      text: `<b>${c.name}</b> se lleva el <b>${c.pct.toFixed(0)}%</b> de lo que gastás (${formatCents(c.grossCents)}).`,
    });
  }

  if (a.byPaymentMethod[0] && k.grossCents) {
    const p = a.byPaymentMethod[0];
    out.push({
      emoji: "💳",
      text: `El <b>${p.pct.toFixed(0)}%</b> de tus gastos son con <b>${paymentMethodLabels[p.method] ?? p.method}</b>.`,
    });
  }

  const wd = [...a.byWeekday].sort((x, y) => y.avgCents - x.avgCents)[0];
  if (wd && wd.avgCents > 0) {
    out.push({
      emoji: "📅",
      text: `Gastás más los <b>${DOW_FULL[wd.dow]}</b> (${formatCents(wd.avgCents)} promedio por día).`,
    });
  }

  if (Math.abs(pace.vsPrevPct) >= 8 && pace.prevToDateCents > 0) {
    const up = pace.vsPrevPct > 0;
    out.push({
      emoji: up ? "📈" : "📉",
      text: `Vas <b>${Math.abs(pace.vsPrevPct).toFixed(0)}%</b> ${up ? "por encima" : "por debajo"} del ritmo de ${pace.prevMonthLabel} (a igual día del mes).`,
    });
  }

  if (k.daysNoSpend > 0 && k.spanDays > 7) {
    out.push({
      emoji: "🟢",
      text: `Tuviste <b>${k.daysNoSpend}</b> ${k.daysNoSpend === 1 ? "día" : "días"} sin gastar de ${k.spanDays}.`,
    });
  }

  if (k.incomeCents > 0) {
    if (k.balanceCents >= 0) {
      out.push({
        emoji: "✅",
        text: `El período cierra en <b style="color:var(--pos,#0f9d6b)">verde</b>: ${formatCents(k.balanceCents)} (${((k.balanceCents / k.incomeCents) * 100).toFixed(0)}% de lo que entró).`,
      });
    } else {
      out.push({
        emoji: "⚠️",
        text: `El período cierra en <b style="color:var(--destructive)">rojo</b> por ${formatCents(-k.balanceCents)}: gastaste más de lo que entró.`,
      });
    }
  }

  if (pace.projectionCents > 0) {
    out.push({
      emoji: "🔮",
      text: `Si seguís este ritmo, ${pace.monthLabel} va a cerrar cerca de <b>${formatCents(pace.projectionCents)}</b> en gastos.`,
    });
  }

  return out;
}
