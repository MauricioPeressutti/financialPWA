import Link from "next/link";

import { AnalyticsRange } from "@/components/analytics-range";
import { BarRow, WeekdayBars } from "@/components/analytics-bits";
import { TrendChart } from "@/components/trend-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTeam } from "@/lib/auth";
import {
  getAnalytics,
  getMonthlyTrend,
  resolveRange,
  type AnalyticsRange as Range,
} from "@/lib/analytics";
import { formatCents } from "@/lib/money";
import { PaymentMethodTag, paymentMethodLabels } from "@/lib/payment-methods";

const RANGES: Range[] = ["1m", "3m", "6m", "1y", "all"];

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-lg border bg-card/40 p-3">
      <p className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 text-base font-semibold tabular-nums ${
          tone === "pos" ? "text-emerald-500" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: PageProps<"/analytics">) {
  const { team } = await requireTeam();
  const sp = await searchParams;
  const range: Range =
    typeof sp.range === "string" && RANGES.includes(sp.range as Range)
      ? (sp.range as Range)
      : "3m";
  const { from, to } = resolveRange(range);

  const [a, trend] = await Promise.all([
    getAnalytics(team.id, from, to),
    getMonthlyTrend(team.id, 12),
  ]);

  const empty = a.kpis.count === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Análisis</h1>
      </div>
      <AnalyticsRange value={range} />

      {empty ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No hay gastos en este período.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Gastado" value={formatCents(a.kpis.grossCents)} />
            <Kpi
              label="Reintegros"
              value={formatCents(a.kpis.reimbursedCents)}
              tone="pos"
            />
            <Kpi label="Neto" value={formatCents(a.kpis.netCents)} />
            <Kpi label="Prom. por día" value={formatCents(a.kpis.avgPerDayCents)} />
            <Kpi label="Gastos" value={String(a.kpis.count)} />
            <Kpi label="Ticket promedio" value={formatCents(a.kpis.avgTicketCents)} />
            <Kpi label="Gasto más grande" value={formatCents(a.kpis.maxExpenseCents)} />
            <Kpi
              label="Recupero"
              value={`${a.kpis.refundRatePct.toFixed(0)}%`}
            />
          </div>

          <Section title="Tendencia mensual" hint="neto · últimos 12 meses">
            <Card>
              <CardContent className="pt-2">
                <TrendChart data={trend} />
              </CardContent>
            </Card>
          </Section>

          <Section title="En qué se va" hint="por categoría">
            <div className="divide-y">
              {a.byCategory.map((c) => (
                <BarRow
                  key={c.name}
                  label={c.name}
                  valueCents={c.grossCents}
                  pct={c.pct}
                  meta={`${c.count}`}
                />
              ))}
            </div>
          </Section>

          {a.bySubcategory.length > 0 && (
            <Section title="Detalle por subcategoría" hint="top 8">
              <div className="divide-y">
                {a.bySubcategory.map((s) => (
                  <BarRow
                    key={`${s.categoryName}-${s.name}`}
                    label={s.name}
                    sublabel={s.categoryName}
                    valueCents={s.grossCents}
                    pct={s.pct}
                    meta={`${s.count}`}
                  />
                ))}
              </div>
            </Section>
          )}

          <Section title="Quién gastó más">
            <div className="divide-y">
              {a.byMember.map((m) => (
                <BarRow
                  key={m.name}
                  label={m.name}
                  valueCents={m.grossCents}
                  pct={m.pct}
                  meta={`${m.count} · ${formatCents(m.avgTicketCents)}/gasto`}
                />
              ))}
            </div>
          </Section>

          <Section title="Formas de pago">
            <div className="divide-y">
              {a.byPaymentMethod.map((p) => (
                <BarRow
                  key={p.method}
                  label={paymentMethodLabels[p.method] ?? p.method}
                  valueCents={p.grossCents}
                  pct={p.pct}
                  meta={`${p.count}`}
                />
              ))}
            </div>
          </Section>

          <Section title="Por día de la semana" hint="total gastado">
            <Card>
              <CardContent className="pt-4">
                <WeekdayBars data={a.byWeekday} />
              </CardContent>
            </Card>
          </Section>

          <Section title="Gastos más grandes" hint="top 10">
            <div className="divide-y">
              {a.topExpenses.map((e) => (
                <Link
                  key={e.id}
                  href={`/expenses/${e.id}`}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate">
                      {e.categoryName}
                      {e.subcategoryName ? ` · ${e.subcategoryName}` : ""}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>
                        {e.spentOn}
                        {e.createdBy ? ` · ${e.createdBy}` : ""} ·
                      </span>
                      <PaymentMethodTag method={e.paymentMethod} />
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium tabular-nums">
                      {formatCents(e.amountCents)}
                    </p>
                    {e.netCents !== e.amountCents && (
                      <p className="text-xs text-emerald-500 tabular-nums">
                        neto {formatCents(e.netCents)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
