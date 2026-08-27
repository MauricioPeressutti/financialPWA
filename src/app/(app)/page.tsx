import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTeam } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { PaymentMethodTag } from "@/lib/payment-methods";
import { IncomeMethodTag } from "@/lib/income-methods";
import {
  currentMonth,
  getMonthlyDashboard,
  listExpenses,
  listIncomes,
} from "@/lib/queries";
import { MonthPicker } from "@/components/month-picker";

export default async function DashboardPage({
  searchParams,
}: PageProps<"/">) {
  const { team } = await requireTeam();
  const sp = await searchParams;
  const month = typeof sp.month === "string" ? sp.month : currentMonth();

  const [data, recent, recentIncomes] = await Promise.all([
    getMonthlyDashboard(team.id, month),
    listExpenses(team.id, { month }),
    listIncomes(team.id, { month }),
  ]);

  const positive = data.balanceCents >= 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Resumen</h1>
        <MonthPicker value={month} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Ingresos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold text-emerald-600">
            {formatCents(data.incomeCents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Gastos (neto)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {formatCents(data.netCents)}
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
            {formatCents(Math.abs(data.balanceCents))}
          </CardContent>
        </Card>
      </div>

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
                <span>{c.categoryName}</span>
                <span className="font-medium">{formatCents(c.totalCents)}</span>
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
                <span>{c.categoryName}</span>
                <span className="font-medium text-emerald-600">
                  {formatCents(c.totalCents)}
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
          {recentIncomes.slice(0, 3).map((e) => (
            <Link
              key={e.id}
              href={`/incomes/${e.id}`}
              className="flex items-center justify-between py-2 text-sm"
            >
              <div>
                <p>
                  {e.categoryName}
                  {e.subcategoryName ? ` · ${e.subcategoryName}` : ""}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{e.receivedOn} ·</span>
                  <IncomeMethodTag method={e.method} />
                </p>
              </div>
              <span className="font-medium text-emerald-600">
                +{formatCents(e.amountCents)}
              </span>
            </Link>
          ))}
          {recent.slice(0, 8).map((e) => (
            <Link
              key={e.id}
              href={`/expenses/${e.id}`}
              className="flex items-center justify-between py-2 text-sm"
            >
              <div>
                <p>
                  {e.categoryName}
                  {e.subcategoryName ? ` · ${e.subcategoryName}` : ""}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{e.spentOn} ·</span>
                  <PaymentMethodTag method={e.paymentMethod} />
                </p>
              </div>
              <span className="font-medium">{formatCents(e.amountCents)}</span>
            </Link>
          ))}
          {recent.length === 0 && recentIncomes.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">
              Nada por acá todavía.
            </p>
          )}
        </div>
      </section>

      <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-10 flex flex-col gap-2">
        <Button
          variant="outline"
          className="h-11 rounded-full px-5 shadow-lg"
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
