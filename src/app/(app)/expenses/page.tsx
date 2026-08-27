import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ExpenseFilters } from "@/components/expense-filters";
import { requireTeam } from "@/lib/auth";
import { formatCents, PAYMENT_METHOD_LABELS } from "@/lib/money";
import { getActiveCategories, listExpenses } from "@/lib/queries";

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const { team } = await requireTeam();
  const sp = await searchParams;

  const str = (v: string | string[] | undefined) =>
    typeof v === "string" && v ? v : undefined;

  const filters = {
    from: str(sp.from),
    to: str(sp.to),
    categoryId: str(sp.categoryId),
    paymentMethod: str(sp.paymentMethod) as
      | "efectivo"
      | "debito"
      | "credito"
      | undefined,
  };

  const [categories, rows] = await Promise.all([
    getActiveCategories(team.id),
    listExpenses(team.id, filters),
  ]);

  const total = rows.reduce((a, r) => a + r.amountCents, 0);
  const totalNet = rows.reduce((a, r) => a + r.amountCents - Number(r.reimbursedCents), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Gastos</h1>
        <Button size="sm" render={<Link href="/expenses/new">+ Gasto</Link>} />
      </div>

      <ExpenseFilters
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />

      <div className="flex justify-between rounded-lg bg-muted px-3 py-2 text-sm">
        <span>{rows.length} gastos · {formatCents(total)}</span>
        <span className="font-medium">Neto {formatCents(totalNet)}</span>
      </div>

      <div className="divide-y">
        {rows.map((e) => {
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
                <p className="text-xs text-muted-foreground">
                  {e.spentOn} · {PAYMENT_METHOD_LABELS[e.paymentMethod]}
                  {e.description ? ` · ${e.description}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-medium">{formatCents(e.amountCents)}</p>
                {Number(e.reimbursedCents) > 0 && (
                  <p className="text-xs text-emerald-600">neto {formatCents(net)}</p>
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
