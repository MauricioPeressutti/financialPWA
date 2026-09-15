import Link from "next/link";

import { AnalyticsRange } from "@/components/analytics-range";
import { AnalyticsMember } from "@/components/analytics-member";
import { CurrencyTabs } from "@/components/currency-tabs";
import { BarRow, WeekdayBars } from "@/components/analytics-bits";
import { CategoryDonut } from "@/components/analytics/category-donut";
import { SpendHeatmap } from "@/components/analytics/spend-heatmap";
import { PaceChart } from "@/components/analytics/pace-chart";
import { TrendDual } from "@/components/analytics/trend-dual";
import { Card, CardContent } from "@/components/ui/card";
import { requireTeam } from "@/lib/auth";
import {
  getAnalytics,
  getDailySpend,
  getMonthlyTrend,
  getSpendPace,
  resolveRange,
  type AnalyticsRange as Range,
} from "@/lib/analytics";
import { buildCategoryColors, catColorVar } from "@/lib/category-colors";
import { parseCustomRange } from "@/lib/analytics-range";
import { buildInsights } from "@/lib/analytics-insights";
import { getAiAdvice, type AdviceItem } from "@/lib/ai-advice";
import { formatMoney } from "@/lib/money";
import { IncomeMethodTag } from "@/lib/income-methods";
import { PaymentMethodTag, paymentMethodLabels } from "@/lib/payment-methods";
import {
  getActiveCategories,
  getTeamCurrencies,
  getTeamMembers,
} from "@/lib/queries";

const RANGES: Range[] = ["1w", "1m", "3m", "6m"];
const GREEN = "#10b981";
// El mapa de calor siempre muestra una ventana fija de ~3 meses,
// sin importar el filtro de tiempo elegido.
const HEATMAP_DAYS = 100;
const HEATMAP_WEEKS = 14;

function Kpi({
  label,
  value,
  sub,
  tone,
  note,
  wide,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "pos" | "neg";
  /** Aviso corto para un valor atípico (ej. un % distorsionado por el rango). */
  note?: string;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-card/40 p-3 ${wide ? "col-span-2" : ""}`}>
      <p className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 text-[1.02rem] font-semibold tabular-nums ${
          tone === "pos" ? "text-emerald-500" : tone === "neg" ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
      {sub ? <p className="text-[0.66rem] text-muted-foreground tabular-nums">{sub}</p> : null}
      {note ? (
        <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[0.6rem] font-medium text-amber-600 dark:text-amber-400">
          ⚠ {note}
        </p>
      ) : null}
    </div>
  );
}

function KpiGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground/80">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-2">{children}</div>
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

const ADVICE_META: Record<AdviceItem["kind"], { label: string; color: string }> = {
  alerta: { label: "Alerta", color: "var(--destructive)" },
  ahorro: { label: "Ahorro", color: "#f59e0b" },
  no_recurrente: { label: "No recurrente", color: "#38bdf8" },
  positivo: { label: "Positivo", color: "#10b981" },
};

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const { team } = await requireTeam();
  const sp = await searchParams;
  const range: Range =
    typeof sp.range === "string" && RANGES.includes(sp.range as Range)
      ? (sp.range as Range)
      : "3m";
  const custom = parseCustomRange(sp);
  const { from, to } = custom ?? resolveRange(range);

  const [members, teamCurrencies] = await Promise.all([
    getTeamMembers(team.id),
    getTeamCurrencies(team.id),
  ]);
  const currencies = teamCurrencies.length ? teamCurrencies : [team.primaryCurrency];
  const cur =
    typeof sp.cur === "string" && currencies.includes(sp.cur)
      ? sp.cur
      : currencies[0];

  const memberId =
    typeof sp.member === "string" && members.some((m) => m.userId === sp.member)
      ? sp.member
      : undefined;

  const [a, trend, pace, expenseCats, heatDays, aiAdvice] = await Promise.all([
    getAnalytics(team.id, from, to, cur, memberId),
    getMonthlyTrend(team.id, 12, cur, memberId),
    getSpendPace(team.id, cur, memberId),
    getActiveCategories(team.id, "expense"),
    getDailySpend(team.id, HEATMAP_DAYS, cur, memberId),
    getAiAdvice(team.id, cur),
  ]);
  const todayIso = new Date().toISOString().slice(0, 10);

  const colors = buildCategoryColors(expenseCats.map((c) => c.name));
  const insights = buildInsights(a, pace, cur);
  const k = a.kpis;
  const empty = k.count === 0 && k.incomeCount === 0;
  const fm = (c: number) => formatMoney(c, cur);

  const balancePos = k.balanceCents >= 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Análisis</h1>

      <div className="space-y-2">
        <CurrencyTabs currencies={currencies} value={cur} />
        <AnalyticsRange value={range} custom={custom} />
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
                {fm(Math.abs(k.balanceCents))}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <b className="text-foreground">{fm(k.incomeCents)}</b> ingresos ·{" "}
                <b className="text-foreground">{fm(k.netCents)}</b> gastos netos
              </p>
            </CardContent>
          </Card>

          {/* KPIs — agrupados por tema para que no todo pese lo mismo */}
          <div className="space-y-4">
            <KpiGroup label="Balance">
              <Kpi
                label="Gastado"
                value={fm(k.netCents)}
                sub={k.reimbursedCents ? `de ${fm(k.grossCents)} bruto` : undefined}
              />
              <Kpi label="Ingresos" value={fm(k.incomeCents)} sub={`${k.incomeCount} mov.`} tone="pos" />
            </KpiGroup>

            <KpiGroup label="Ritmo">
              <Kpi label="Prom. por día" value={fm(k.avgPerDayCents)} sub={`${k.spanDays} días`} />
              <Kpi
                label={`Proyección de ${pace.monthLabel}`}
                value={fm(pace.projectionCents)}
                sub={`hoy vas ${fm(pace.curTotalCents)}`}
              />
              <Kpi
                wide
                label={`Ritmo vs ${pace.prevMonthLabel}`}
                value={`${pace.vsPrevPct >= 0 ? "+" : ""}${pace.vsPrevPct.toFixed(0)}%`}
                sub="a igual día del mes"
                tone={Math.abs(pace.vsPrevPct) < 1 ? undefined : pace.vsPrevPct > 0 ? "neg" : "pos"}
                note={
                  Math.abs(pace.vsPrevPct) >= 150
                    ? `compara ${k.spanDays} días contra 1 mes — dato distorsionado`
                    : undefined
                }
              />
            </KpiGroup>

            <KpiGroup label="Extremos">
              <Kpi label="Ticket promedio" value={fm(k.avgTicketCents)} sub={`${k.count} gastos`} />
              <Kpi label="Gasto más grande" value={fm(k.maxExpenseCents)} />
              <Kpi
                label="Día más caro"
                value={k.maxDayCents ? fm(k.maxDayCents) : "—"}
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
                wide
                label="Recupero"
                value={`${k.refundRatePct.toFixed(0)}%`}
                sub={k.reimbursedCents ? fm(k.reimbursedCents) : "sin reintegros"}
                tone={k.reimbursedCents ? "pos" : undefined}
              />
            </KpiGroup>
          </div>

          {a.byCategory.length > 0 && (
            <Section title="En qué se va" hint="por categoría">
              <Card>
                <CardContent className="pt-4">
                  <CategoryDonut slices={a.byCategory} colors={colors} currency={cur} />
                </CardContent>
              </Card>
            </Section>
          )}

          {heatDays.length > 0 && (
            <Section title="Mapa de gasto diario" hint="últimos 3 meses">
              <Card>
                <CardContent className="pt-4">
                  <SpendHeatmap
                    days={heatDays}
                    to={todayIso}
                    currency={cur}
                    weeks={HEATMAP_WEEKS}
                  />
                </CardContent>
              </Card>
            </Section>
          )}

          <Section title="Ritmo del mes" hint="gasto acumulado">
            <Card>
              <CardContent className="pt-4">
                <PaceChart pace={pace} currency={cur} />
              </CardContent>
            </Card>
          </Section>

          <Section title="Gastos vs ingresos" hint="últimos 12 meses">
            <Card>
              <CardContent className="pt-2">
                <TrendDual data={trend} currency={cur} />
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
                    fmt={fm}
                    meta={`${c.count} · ${fm(Math.round(c.grossCents / Math.max(c.count, 1)))}/mov`}
                    fill={catColorVar(colors[c.name] ?? -1)}
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
                    fmt={fm}
                    meta={`${s.count}`}
                    fill={catColorVar(colors[s.categoryName] ?? -1)}
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
                  fmt={fm}
                  meta={`${p.count}`}
                />
              ))}
            </div>
          </Section>

          {a.byEntity.length > 0 && (
            <Section
              title="Por banco / billetera"
              hint={
                a.entityCoveragePct < 95
                  ? `${a.entityCoveragePct.toFixed(0)}% de los gastos tiene entidad`
                  : undefined
              }
            >
              <div className="divide-y">
                {a.byEntity.map((e) => (
                  <BarRow
                    key={e.name}
                    label={e.name}
                    valueCents={e.grossCents}
                    pct={e.pct}
                    fmt={fm}
                    meta={`${e.count}`}
                  />
                ))}
              </div>
            </Section>
          )}

          {!memberId && a.byMember.length > 1 && (
            <Section title="Quién gastó más">
              <div className="space-y-3">
                {a.byMember.map((m) => (
                  <div key={m.userId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{m.name}</span>
                      <span className="font-semibold tabular-nums">{fm(m.netCents)}</span>
                    </div>
                    <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                      {m.byCategory.map((c) => (
                        <span
                          key={c.name}
                          style={{
                            width: `${(c.cents / Math.max(m.grossCents, 1)) * 100}%`,
                            background: catColorVar(colors[c.name] ?? -1),
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {m.byCategory.slice(0, 3).map((c) => (
                        <span
                          key={c.name}
                          className="inline-flex items-center gap-1 text-[0.66rem] text-muted-foreground"
                        >
                          <span
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ background: catColorVar(colors[c.name] ?? -1) }}
                          />
                          {c.name} {((c.cents / Math.max(m.grossCents, 1)) * 100).toFixed(0)}%
                        </span>
                      ))}
                    </div>
                    <p className="text-[0.68rem] text-muted-foreground tabular-nums">
                      {m.pct.toFixed(0)}% del total · {m.count} gastos ·{" "}
                      {fm(m.avgTicketCents)}/gasto
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
                    fmt={fm}
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
                      fmt={fm}
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
                        {formatMoney(m.amountCents, m.currency)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </Section>
          )}

          {aiAdvice && aiAdvice.items.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-medium">
                  Consejos de la IA
                  <span className="rounded-full bg-gradient-to-r from-primary/30 to-violet-400/30 px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wide text-foreground">
                    ✦ IA
                  </span>
                </h2>
                <span className="text-xs text-muted-foreground">generado hoy</span>
              </div>
              <div className="space-y-2">
                {aiAdvice.items.map((it, idx) => {
                  const meta = ADVICE_META[it.kind];
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 rounded-xl border border-l-[3px] bg-card/40 p-3 text-[0.82rem] leading-snug"
                      style={{ borderLeftColor: meta.color }}
                    >
                      <span className="text-base leading-tight">{it.emoji}</span>
                      <div className="min-w-0">
                        <p className="font-medium">{it.title}</p>
                        <p className="text-muted-foreground">{it.detail}</p>
                        <span
                          className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wide"
                          style={{
                            background: `color-mix(in oklab, ${meta.color} 18%, transparent)`,
                            color: meta.color,
                          }}
                        >
                          {meta.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
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
