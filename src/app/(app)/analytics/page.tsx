import Link from "next/link";

import { AnalyticsRange } from "@/components/analytics-range";
import { AnalyticsMember } from "@/components/analytics-member";
import { BarRow, WeekdayBars } from "@/components/analytics-bits";
import { CategoryDonut } from "@/components/analytics/category-donut";
import { SpendHeatmap } from "@/components/analytics/spend-heatmap";
import { PaceChart } from "@/components/analytics/pace-chart";
import { TrendDual } from "@/components/analytics/trend-dual";
import { Card, CardContent } from "@/components/ui/card";
import { requireTeam } from "@/lib/auth";
import {
  buildCategoryColors,
  getAnalytics,
  getMonthlyTrend,
  getSpendPace,
  resolveRange,
  type AnalyticsRange as Range,
} from "@/lib/analytics";
import { buildInsights } from "@/lib/analytics-insights";
import { formatCents } from "@/lib/money";
import { IncomeMethodTag } from "@/lib/income-methods";
import { PaymentMethodTag, paymentMethodLabels } from "@/lib/payment-methods";
import { getActiveCategories, getTeamMembers } from "@/lib/queries";

const RANGES: Range[] = ["1m", "3m", "6m", "1y", "all"];
const GREEN = "#10b981";

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="rounded-xl border bg-card/40 p-3">
      <p className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 text-[1.02rem] font-semibold tabular-nums ${
          tone === "pos" ? "text-emerald-500" : tone === "neg" ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
      {sub ? <p className="text-[0.66rem] text-muted-foreground tabular-nums">{sub}</p> : null}
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
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const { team } = await requireTeam();
  const sp = await searchParams;
  const range: Range =
    typeof sp.range === "string" && RANGES.includes(sp.range as Range)
      ? (sp.range as Range)
      : "3m";
  const { from, to } = resolveRange(range);

  const members = await getTeamMembers(team.id);
  const memberId =
    typeof sp.member === "string" && members.some((m) => m.userId === sp.member)
      ? sp.member
      : undefined;

  const [a, trend, pace, expenseCats] = await Promise.all([
    getAnalytics(team.id, from, to, memberId),
    getMonthlyTrend(team.id, 12, memberId),
    getSpendPace(team.id, memberId),
    getActiveCategories(team.id, "expense"),
  ]);

  const colors = buildCategoryColors(expenseCats.map((c) => c.name));
  const insights = buildInsights(a, pace);
  const k = a.kpis;
  const empty = k.count === 0 && k.incomeCount === 0;

  const balancePos = k.balanceCents >= 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Análisis</h1>

      <div className="space-y-2">
        <AnalyticsRange value={range} />
        {members.length > 1 && (
          <AnalyticsMember
            members={members.map((m) => ({
              userId: m.userId,
              name: (m.displayName ?? m.email).split(" ")[0],
            }))}
            value={memberId}
          />
        )}
      </div>

      {empty ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No hay movimientos en este período.
        </p>
      ) : (
        <>
          {/* BALANCE */}
          <Card>
            <CardContent className="py-5 text-center">
              <p className="text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                Balance del período
              </p>
              <p
                className={`mt-1 text-[2.4rem] font-bold leading-none ${
                  balancePos ? "text-emerald-500" : "text-destructive"
                }`}
              >
                {balancePos ? "" : "−"}
                {formatCents(Math.abs(k.balanceCents))}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <b className="text-foreground">{formatCents(k.incomeCents)}</b> ingresos ·{" "}
                <b className="text-foreground">{formatCents(k.netCents)}</b> gastos netos
              </p>
            </CardContent>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2">
            <Kpi
              label="Gastado"
              value={formatCents(k.netCents)}
              sub={k.reimbursedCents ? `de ${formatCents(k.grossCents)} bruto` : undefined}
            />
            <Kpi label="Ingresos" value={formatCents(k.incomeCents)} sub={`${k.incomeCount} mov.`} tone="pos" />
            <Kpi label="Prom. por día" value={formatCents(k.avgPerDayCents)} sub={`${k.spanDays} días`} />
            <Kpi
              label={`Proyección de ${pace.monthLabel}`}
              value={formatCents(pace.projectionCents)}
              sub={`hoy vas ${formatCents(pace.curTotalCents)}`}
            />
            <Kpi
              label={`Ritmo vs ${pace.prevMonthLabel}`}
              value={`${pace.vsPrevPct >= 0 ? "+" : ""}${pace.vsPrevPct.toFixed(0)}%`}
              sub="a igual día del mes"
              tone={Math.abs(pace.vsPrevPct) < 1 ? undefined : pace.vsPrevPct > 0 ? "neg" : "pos"}
            />
            <Kpi label="Ticket promedio" value={formatCents(k.avgTicketCents)} sub={`${k.count} gastos`} />
            <Kpi label="Gasto más grande" value={formatCents(k.maxExpenseCents)} />
            <Kpi
              label="Día más caro"
              value={k.maxDayCents ? formatCents(k.maxDayCents) : "—"}
              sub={
                k.maxDayDate
                  ? new Date(k.maxDayDate + "T00:00:00").toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "short",
                    })
                  : undefined
              }
            />
            <Kpi label="Días sin gastar" value={String(k.daysNoSpend)} sub={`de ${k.spanDays}`} />
            <Kpi
              label="Recupero"
              value={`${k.refundRatePct.toFixed(0)}%`}
              sub={k.reimbursedCents ? formatCents(k.reimbursedCents) : "sin reintegros"}
              tone={k.reimbursedCents ? "pos" : undefined}
            />
          </div>

          {a.byCategory.length > 0 && (
            <Section title="En qué se va" hint="por categoría">
              <Card>
                <CardContent className="pt-4">
                  <CategoryDonut slices={a.byCategory} colors={colors} />
                </CardContent>
              </Card>
            </Section>
          )}

          {a.days.length > 0 && (
            <Section title="Mapa de gasto diario">
              <Card>
                <CardContent className="pt-4">
                  <SpendHeatmap days={a.days} to={to} />
                </CardContent>
              </Card>
            </Section>
          )}

          <Section title="Ritmo del mes" hint="gasto acumulado">
            <Card>
              <CardContent className="pt-4">
                <PaceChart pace={pace} />
              </CardContent>
            </Card>
          </Section>

          <Section title="Gastos vs ingresos" hint="últimos 12 meses">
            <Card>
              <CardContent className="pt-2">
                <TrendDual data={trend} />
              </CardContent>
            </Card>
          </Section>

          <Section title="Por día de la semana" hint="promedio">
            <Card>
              <CardContent className="pt-4">
                <WeekdayBars data={a.byWeekday.map((w) => ({ dow: w.dow, grossCents: w.avgCents }))} />
              </CardContent>
            </Card>
          </Section>

          {a.byCategory.length > 0 && (
            <Section title="Detalle por categoría">
              <div className="divide-y">
                {a.byCategory.map((c) => (
                  <BarRow
                    key={c.name}
                    label={c.name}
                    valueCents={c.netCents}
                    pct={c.pct}
                    meta={`${c.count} · ${formatCents(Math.round(c.grossCents / Math.max(c.count, 1)))}/mov`}
                    fill={`var(--cat-${(colors[c.name] ?? 5) % 6})`}
                  />
                ))}
              </div>
            </Section>
          )}

          {a.bySubcategory.length > 0 && (
            <Section title="Subcategorías" hint="top 8">
              <div className="divide-y">
                {a.bySubcategory.map((s) => (
                  <BarRow
                    key={`${s.categoryName}-${s.name}`}
                    label={s.name}
                    sublabel={s.categoryName}
                    valueCents={s.grossCents}
                    pct={s.pct}
                    meta={`${s.count}`}
                    fill={`var(--cat-${(colors[s.categoryName] ?? 5) % 6})`}
                  />
                ))}
              </div>
            </Section>
          )}

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

          {!memberId && a.byMember.length > 1 && (
            <Section title="Quién gastó más">
              <div className="space-y-3">
                {a.byMember.map((m) => (
                  <div key={m.userId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{m.name}</span>
                      <span className="font-semibold tabular-nums">{formatCents(m.netCents)}</span>
                    </div>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                      {m.byCategory.map((c) => (
                        <span
                          key={c.name}
                          style={{
                            width: `${(c.cents / Math.max(m.grossCents, 1)) * 100}%`,
                            background: `var(--cat-${(colors[c.name] ?? 5) % 6})`,
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-[0.68rem] text-muted-foreground tabular-nums">
                      {m.pct.toFixed(0)}% del total · {m.count} gastos ·{" "}
                      {formatCents(m.avgTicketCents)}/gasto
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {a.incomeBySource.length > 0 && (
            <Section title="Ingresos por fuente">
              <div className="divide-y">
                {a.incomeBySource.map((s) => (
                  <BarRow
                    key={s.name}
                    label={s.name}
                    valueCents={s.totalCents}
                    pct={s.pct}
                    meta={`${s.count}`}
                    fill={GREEN}
                  />
                ))}
              </div>
              {!memberId && a.incomeByMember.length > 1 && (
                <div className="mt-3 divide-y">
                  {a.incomeByMember.map((m) => (
                    <BarRow
                      key={m.name}
                      label={m.name}
                      valueCents={m.totalCents}
                      pct={m.pct}
                      meta={`${m.count}`}
                      fill={GREEN}
                    />
                  ))}
                </div>
              )}
            </Section>
          )}

          {a.topMovements.length > 0 && (
            <Section title="Movimientos más grandes" hint="top 8">
              <div className="divide-y">
                {a.topMovements.map((m) => {
                  const pos = m.kind === "ingreso";
                  return (
                    <Link
                      key={m.kind + m.id}
                      href={pos ? `/incomes/${m.id}` : `/expenses/${m.id}`}
                      className="flex items-center gap-3 py-2 text-sm"
                    >
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-full text-xs ${
                          pos ? "bg-emerald-500/15 text-emerald-600" : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {pos ? "↑" : "↓"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{m.label}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>
                            {new Date(m.on + "T00:00:00").toLocaleDateString("es-AR", {
                              day: "numeric",
                              month: "short",
                            })}
                            {m.createdBy ? ` · ${m.createdBy}` : ""} ·
                          </span>
                          {pos ? (
                            <IncomeMethodTag method={m.method} />
                          ) : (
                            <PaymentMethodTag method={m.method} />
                          )}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 font-semibold tabular-nums ${pos ? "text-emerald-600" : ""}`}
                      >
                        {pos ? "+" : "−"}
                        {formatCents(m.amountCents)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </Section>
          )}

          {insights.length > 0 && (
            <Section title="Observaciones">
              <div className="space-y-2">
                {insights.map((i, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-xl border bg-card/40 p-3 text-[0.82rem] leading-snug"
                  >
                    <span className="text-base leading-tight">{i.emoji}</span>
                    <span dangerouslySetInnerHTML={{ __html: i.text }} />
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
