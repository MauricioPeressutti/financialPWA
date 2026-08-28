import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ExpenseFilters } from "@/components/expense-filters";
import { MovimientosTabs } from "@/components/movimientos-tabs";
import { requireTeam } from "@/lib/auth";
import { formatCents, formatMoney } from "@/lib/money";
import { fmtDay, fmtTime } from "@/lib/datetime";
import { PaymentMethodTag, type PaymentMethod } from "@/lib/payment-methods";
import { getActiveCategories, listExpenses } from "@/lib/queries";

export default async function MovimientosPage({
  searchParams,
}: PageProps<"/movimientos">) {
  const { team } = await requireTeam();
  const sp = await searchParams;

  const str = (v: string | string[] | undefined) =>
    typeof v === "string" && v ? v : undefined;

  const filters = {
    from: str(sp.from),
    to: str(sp.to),
    categoryId: str(sp.categoryId),
    paymentMethod: str(sp.paymentMethod) as PaymentMethod | undefined,
  };

  const [categories, rows] = await Promise.all([
    getActiveCategories(team.id, "expense"),
    listExpenses(team.id, filters),
  ]);

  const primary = team.primaryCurrency;
  const total = rows.reduce((a, r) => a + r.baseAmountCents, 0);
  const totalNet = rows.reduce(
    (a, r) => a + r.baseAmountCents - Number(r.reimbursedBaseCents),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Movimientos</h1>
        <Button size="sm" render={<Link href="/expenses/new">+ Gasto</Link>} />
      </div>

      <MovimientosTabs />

      <ExpenseFilters
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />

      <div className="flex justify-between rounded-lg bg-muted px-3 py-2 text-sm">
        <span>
          {rows.length} gastos · {formatCents(total)}
        </span>
        <span className="font-medium">Neto {formatCents(totalNet)}</span>
      </div>

      <div className="divide-y">
        {rows.map((e) => {
          const foreign = e.currency !== primary;
          const net = e.amountCents - Number(e.reimbursedCents);
          return (
            <Link
              key={e.id}
              href={`/expenses/${e.id}`}
              className="flex items-center justify-between py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate">
                  {e.categoryName}
                  {e.subcategoryName ? ` · ${e.subcategoryName}` : ""}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>
                    {fmtDay(e.spentOn)} · {fmtTime(e.createdAt)}
                  </span>
                  <span>·</span>
                  <PaymentMethodTag method={e.paymentMethod} />
                  {e.description ? <span>· {e.description}</span> : null}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-medium">
                  {formatMoney(e.amountCents, e.currency)}
                </p>
                {foreign && (
                  <p className="text-xs text-muted-foreground">
                    ≈ {formatCents(e.baseAmountCents)}
                  </p>
                )}
                {Number(e.reimbursedCents) > 0 && (
                  <p className="text-xs text-emerald-600">
                    neto {formatMoney(net, e.currency)}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
        {rows.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay gastos con esos filtros.
          </p>
        )}
      </div>
    </div>
  );
}
