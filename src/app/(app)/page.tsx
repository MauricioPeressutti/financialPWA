import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTeam } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { PaymentMethodTag } from "@/lib/payment-methods";
import { currentMonth, getMonthlyDashboard, listExpenses } from "@/lib/queries";
import { MonthPicker } from "@/components/month-picker";

export default async function DashboardPage({
  searchParams,
}: PageProps<"/">) {
  const { team } = await requireTeam();
  const sp = await searchParams;
  const month = typeof sp.month === "string" ? sp.month : currentMonth();

  const [data, recent] = await Promise.all([
    getMonthlyDashboard(team.id, month),
    listExpenses(team.id, { month }),
  ]);

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
              Gastado
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {formatCents(data.grossCents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Reintegros
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold text-emerald-600">
            {formatCents(data.reimbursedCents)}
          </CardContent>
        </Card>
        <Card className="col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Neto del mes · {data.count} gastos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {formatCents(data.netCents)}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Por categoría</h2>
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

      {data.byMethod.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Por forma de pago</h2>
          <div className="space-y-1">
            {data.byMethod.map((m) => (
              <div
                key={m.paymentMethod}
                className="flex justify-between border-b py-1.5 text-sm"
              >
                <PaymentMethodTag method={m.paymentMethod} />
                <span className="font-medium">{formatCents(m.totalCents)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Últimos gastos</h2>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/expenses">Ver todos</Link>}
          />
        </div>
        <div className="divide-y">
          {recent.slice(0, 8).map((e) => (
            <Link
              key={e.id}
              href={`/expenses/${e.id}`}
              className="flex items-center justify-between py-2 text-sm"
            >
              <div>
                <p>{e.categoryName}{e.subcategoryName ? ` · ${e.subcategoryName}` : ""}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{e.spentOn} ·</span>
                  <PaymentMethodTag method={e.paymentMethod} />
                </p>
              </div>
              <span className="font-medium">{formatCents(e.amountCents)}</span>
            </Link>
          ))}
          {recent.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">Nada por acá todavía.</p>
          )}
        </div>
      </section>

      <Button
        className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-10 h-12 rounded-full px-5 shadow-lg"
        render={<Link href="/expenses/new">+ Gasto</Link>}
      />
    </div>
  );
}
