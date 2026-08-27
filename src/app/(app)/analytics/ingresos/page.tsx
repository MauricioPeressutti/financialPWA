import Link from "next/link";

import { AnalyticsRange } from "@/components/analytics-range";
import { AnalyticsMember } from "@/components/analytics-member";
import { AnalyticsTabs } from "@/components/analytics-tabs";
import { BarRow } from "@/components/analytics-bits";
import { TrendChart } from "@/components/trend-chart";
import { Card, CardContent } from "@/components/ui/card";
import { requireTeam } from "@/lib/auth";
import { resolveRange, type AnalyticsRange as Range } from "@/lib/analytics-range";
import {
  getIncomeAnalytics,
  getMonthlyIncomeTrend,
} from "@/lib/analytics-income";
import { formatCents } from "@/lib/money";
import { IncomeMethodTag, incomeMethodLabels } from "@/lib/income-methods";
import { getTeamMembers } from "@/lib/queries";

const RANGES: Range[] = ["1m", "3m", "6m", "1y", "all"];
const GREEN = "#10b981";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card/40 p-3">
      <p className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-emerald-500">
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

export default async function IncomeAnalyticsPage({
  searchParams,
}: PageProps<"/analytics/ingresos">) {
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

  const [a, trend] = await Promise.all([
    getIncomeAnalytics(team.id, from, to, memberId),
    getMonthlyIncomeTrend(team.id, 12, memberId),
  ]);

  const empty = a.kpis.count === 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Análisis</h1>
      <AnalyticsTabs />
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
          No hay ingresos en este período.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Total" value={formatCents(a.kpis.totalCents)} />
            <Kpi label="Prom. por día" value={formatCents(a.kpis.avgPerDayCents)} />
            <Kpi label="Ingresos" value={String(a.kpis.count)} />
            <Kpi label="Promedio" value={formatCents(a.kpis.avgCents)} />
            <Kpi label="Más grande" value={formatCents(a.kpis.maxCents)} />
          </div>

          <Section title="Tendencia mensual" hint="últimos 12 meses">
            <Card>
              <CardContent className="pt-2">
                <TrendChart data={trend} />
              </CardContent>
            </Card>
          </Section>

          <Section title="Por fuente">
            <div className="divide-y">
              {a.bySource.map((c) => (
                <BarRow
                  key={c.name}
                  label={c.name}
                  valueCents={c.totalCents}
                  pct={c.pct}
                  meta={`${c.count}`}
                  fill={GREEN}
                />
              ))}
            </div>
          </Section>

          {a.bySubcategory.length > 0 && (
            <Section title="Detalle" hint="top 8">
              <div className="divide-y">
                {a.bySubcategory.map((s) => (
                  <BarRow
                    key={`${s.categoryName}-${s.name}`}
                    label={s.name}
                    sublabel={s.categoryName}
                    valueCents={s.totalCents}
                    pct={s.pct}
                    meta={`${s.count}`}
                    fill={GREEN}
                  />
                ))}
              </div>
            </Section>
          )}

          {!memberId && a.byMember.length > 1 && (
            <Section title="Quién ingresó más">
              <div className="divide-y">
                {a.byMember.map((m) => (
                  <BarRow
                    key={m.name}
                    label={m.name}
                    valueCents={m.totalCents}
                    pct={m.pct}
                    meta={`${m.count} · ${formatCents(m.avgCents)}/mov`}
                    fill={GREEN}
                  />
                ))}
              </div>
            </Section>
          )}

          <Section title="Medios de cobro">
            <div className="divide-y">
              {a.byMethod.map((p) => (
                <BarRow
                  key={p.method}
                  label={incomeMethodLabels[p.method] ?? p.method}
                  valueCents={p.totalCents}
                  pct={p.pct}
                  meta={`${p.count}`}
                  fill={GREEN}
                />
              ))}
            </div>
          </Section>

          <Section title="Ingresos más grandes" hint="top 10">
            <div className="divide-y">
              {a.topIncomes.map((e) => (
                <Link
                  key={e.id}
                  href={`/incomes/${e.id}`}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate">
                      {e.categoryName}
                      {e.subcategoryName ? ` · ${e.subcategoryName}` : ""}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>
                        {e.receivedOn}
                        {e.createdBy ? ` · ${e.createdBy}` : ""} ·
                      </span>
                      <IncomeMethodTag method={e.method} />
                    </p>
                  </div>
                  <p className="shrink-0 font-medium tabular-nums text-emerald-500">
                    {formatCents(e.amountCents)}
                  </p>
                </Link>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
