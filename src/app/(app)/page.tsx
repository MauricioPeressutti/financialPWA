import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTeam } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { fmtDay, fmtTime } from "@/lib/datetime";
import { PaymentMethodTag } from "@/lib/payment-methods";
import { IncomeMethodTag } from "@/lib/income-methods";
import {
  currentMonth,
  getMonthlyDashboard,
  getTeamCurrencies,
  listExpenses,
  listIncomes,
} from "@/lib/queries";
import { MonthPicker } from "@/components/month-picker";
import { CurrencyTabs } from "@/components/currency-tabs";
import { getTeamBalance } from "@/lib/balance";
import { getTopGoal } from "@/lib/goals";
import { getUpcomingStatement } from "@/lib/card-statements";
import { CategoryIcon } from "@/lib/category-icons";

export default async function DashboardPage({
  searchParams,
}: PageProps<"/">) {
  const { user, team } = await requireTeam();
  const sp = await searchParams;
  const month = typeof sp.month === "string" ? sp.month : currentMonth();

  const teamCurrencies = await getTeamCurrencies(team.id);
  const currencies = teamCurrencies.length
    ? teamCurrencies
    : [team.primaryCurrency];
  const cur =
    typeof sp.cur === "string" && currencies.includes(sp.cur)
      ? sp.cur
      : currencies[0];
  const fm = (c: number) => formatMoney(c, cur);

  const [data, recent, recentIncomes, balance, topGoal, upcomingCard] =
    await Promise.all([
      getMonthlyDashboard(team.id, month, cur),
      listExpenses(team.id, { month, currency: cur }),
      listIncomes(team.id, { month, currency: cur }),
      team.effortEnabled ? getTeamBalance(team.id, cur) : Promise.resolve(null),
      team.goalsEnabled ? getTopGoal(team.id, user.id) : Promise.resolve(null),
      getUpcomingStatement(team.id),
    ]);

  const cardDays = upcomingCard
    ? Math.round(
        (new Date(upcomingCard.dueDate + "T00:00:00").getTime() -
          new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").getTime()) /
          86400000,
      )
    : 0;

  const positive = data.balanceCents >= 0;

  type Mov = {
    key: string;
    kind: "gasto" | "ingreso";
    id: string;
    date: string;
    createdAt: Date;
    title: string;
    method: string;
    amountCents: number;
    currency: string;
  };
  const movements: Mov[] = [
    ...recentIncomes.map((e) => ({
      key: `i${e.id}`,
      kind: "ingreso" as const,
      id: e.id,
      date: e.receivedOn,
      createdAt: e.createdAt,
      title: `${e.categoryName}${e.subcategoryName ? ` · ${e.subcategoryName}` : ""}`,
      method: e.method,
      amountCents: e.amountCents,
      currency: e.currency,
    })),
    ...recent.map((e) => ({
      key: `e${e.id}`,
      kind: "gasto" as const,
      id: e.id,
      date: e.spentOn,
      createdAt: e.createdAt,
      title: `${e.categoryName}${e.subcategoryName ? ` · ${e.subcategoryName}` : ""}`,
      method: e.paymentMethod,
      amountCents: e.amountCents,
      currency: e.currency,
    })),
  ]
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    )
    .slice(0, 12);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Resumen</h1>
        <MonthPicker value={month} />
      </div>

      <CurrencyTabs currencies={currencies} value={cur} />

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Ingresos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold text-emerald-600">
            {fm(data.incomeCents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Gastos (neto)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {fm(data.netCents)}
          </CardContent>
        </Card>
        <Card className="col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Balance del mes · {data.incomeCount} ingresos · {data.count} gastos
            </CardTitle>
          </CardHeader>
          <CardContent
            className={`text-2xl font-bold ${
              positive ? "text-emerald-600" : "text-destructive"
            }`}
          >
            {positive ? "" : "−"}
            {fm(Math.abs(data.balanceCents))}
          </CardContent>
        </Card>
      </div>

      {upcomingCard && (
        <Link
          href={`/tarjetas/${upcomingCard.id}/revisar`}
          className="block rounded-xl border border-amber-500/40 bg-amber-500/[0.07] px-4 py-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-amber-500">
              💳{" "}
              {cardDays <= 0
                ? "Vence hoy"
                : cardDays === 1
                  ? "Vence mañana"
                  : `Vence en ${cardDays} días`}
            </p>
            <span className="text-[0.7rem] tabular-nums text-muted-foreground">
              {fmtDay(upcomingCard.dueDate)}
            </span>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums">
            {formatMoney(upcomingCard.totalArsCents, "ARS")}
          </p>
          <p className="text-xs text-muted-foreground">
            {upcomingCard.label}
            {upcomingCard.minPaymentArsCents
              ? ` · mínimo ${formatMoney(upcomingCard.minPaymentArsCents, "ARS")}`
              : ""}
          </p>
        </Link>
      )}

      {balance?.suggestion && (
        <Link
          href="/esfuerzo"
          className="flex items-center justify-between gap-3 rounded-xl border bg-card/40 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">
              Esfuerzo · cuentas del equipo
            </p>
            <p className="truncate text-sm font-medium">
              {balance.suggestion.fromName} le debe a {balance.suggestion.toName}{" "}
              <span className="tabular-nums">
                {fm(balance.suggestion.amountCents)}
              </span>
            </p>
          </div>
          <span className="shrink-0 text-primary">→</span>
        </Link>
      )}

      {topGoal && (
        <Link
          href={`/objetivos/${topGoal.id}`}
          className="block rounded-xl border bg-card/40 px-4 py-3"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg" aria-hidden>
              {topGoal.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">
                Objetivo
              </p>
              <p className="truncate text-sm font-medium">{topGoal.name}</p>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {Math.min(100, Math.round(topGoal.pct))}%
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.round(topGoal.pct))}%`,
                background: topGoal.reached ? "#10b981" : "var(--primary)",
              }}
            />
          </div>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            {formatMoney(topGoal.savedCents, topGoal.currency)} de{" "}
            {formatMoney(topGoal.targetCents, topGoal.currency)}
          </p>
        </Link>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Gastos por categoría
        </h2>
        {data.byCategory.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin gastos este mes.</p>
        ) : (
          <div className="space-y-1">
            {data.byCategory.map((c) => (
              <div
                key={c.categoryId}
                className="flex justify-between border-b py-1.5 text-sm"
              >
                <span className="flex items-center gap-1.5">
                  <CategoryIcon name={c.categoryName} />
                  {c.categoryName}
                </span>
                <span className="font-medium">{fm(c.totalCents)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {data.incomeByCategory.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Ingresos por fuente
          </h2>
          <div className="space-y-1">
            {data.incomeByCategory.map((c) => (
              <div
                key={c.categoryId}
                className="flex justify-between border-b py-1.5 text-sm"
              >
                <span className="flex items-center gap-1.5">
                  <CategoryIcon name={c.categoryName} />
                  {c.categoryName}
                </span>
                <span className="font-medium text-emerald-600">
                  {fm(c.totalCents)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Últimos movimientos
          </h2>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/movimientos">Ver todos</Link>}
          />
        </div>
        <div className="divide-y">
          {movements.map((m) => {
            const income = m.kind === "ingreso";
            return (
              <Link
                key={m.key}
                href={income ? `/incomes/${m.id}` : `/expenses/${m.id}`}
                className="flex items-center gap-2.5 py-2 text-sm"
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full ${
                    income
                      ? "bg-emerald-500/15 text-emerald-600"
                      : "bg-destructive/15 text-destructive"
                  }`}
                  aria-hidden
                >
                  {income ? (
                    <ArrowUpRight className="size-4" />
                  ) : (
                    <ArrowDownRight className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate">{m.title}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>
                      {fmtDay(m.date)} · {fmtTime(m.createdAt)} ·
                    </span>
                    {income ? (
                      <IncomeMethodTag method={m.method} />
                    ) : (
                      <PaymentMethodTag method={m.method} />
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-medium tabular-nums ${
                    income ? "text-emerald-600" : ""
                  }`}
                >
                  {income ? "+" : "−"}
                  {formatMoney(m.amountCents, m.currency)}
                </span>
              </Link>
            );
          })}
          {movements.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">
              Nada por acá todavía.
            </p>
          )}
        </div>
      </section>

      <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-10 flex flex-col items-end gap-2">
        <Button
          className="h-11 rounded-full border-0 bg-emerald-600 px-5 text-white shadow-lg hover:bg-emerald-700"
          render={<Link href="/incomes/new">+ Ingreso</Link>}
        />
        <Button
          className="h-12 rounded-full px-5 shadow-lg"
          render={<Link href="/expenses/new">+ Gasto</Link>}
        />
      </div>
    </div>
  );
}
