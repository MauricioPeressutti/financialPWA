import Link from "next/link";

import { Button } from "@/components/ui/button";
import { IncomeFilters } from "@/components/income-filters";
import { MovimientosTabs } from "@/components/movimientos-tabs";
import { requireTeam } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { fmtDay, fmtTime } from "@/lib/datetime";
import { IncomeMethodTag, type IncomeMethod } from "@/lib/income-methods";
import { getActiveCategories, listIncomes } from "@/lib/queries";

export default async function IngresosPage({
  searchParams,
}: PageProps<"/movimientos/ingresos">) {
  const { team } = await requireTeam();
  const sp = await searchParams;

  const str = (v: string | string[] | undefined) =>
    typeof v === "string" && v ? v : undefined;

  const filters = {
    from: str(sp.from),
    to: str(sp.to),
    categoryId: str(sp.categoryId),
    method: str(sp.method) as IncomeMethod | undefined,
  };

  const [categories, rows] = await Promise.all([
    getActiveCategories(team.id, "income"),
    listIncomes(team.id, filters),
  ]);

  const total = rows.reduce((a, r) => a + r.amountCents, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Movimientos</h1>
        <Button size="sm" render={<Link href="/incomes/new">+ Ingreso</Link>} />
      </div>

      <MovimientosTabs />

      <IncomeFilters
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />

      <div className="flex justify-between rounded-lg bg-muted px-3 py-2 text-sm">
        <span>{rows.length} ingresos</span>
        <span className="font-medium text-emerald-600">{formatCents(total)}</span>
      </div>

      <div className="divide-y">
        {rows.map((e) => (
          <Link
            key={e.id}
            href={`/incomes/${e.id}`}
            className="flex items-center justify-between py-2.5 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate">
                {e.categoryName}
                {e.subcategoryName ? ` · ${e.subcategoryName}` : ""}
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>
                  {fmtDay(e.receivedOn)} · {fmtTime(e.createdAt)}
                </span>
                <span>·</span>
                <IncomeMethodTag method={e.method} />
                {e.description ? <span>· {e.description}</span> : null}
              </p>
            </div>
            <p className="shrink-0 font-medium text-emerald-600">
              {formatCents(e.amountCents)}
            </p>
          </Link>
        ))}
        {rows.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay ingresos con esos filtros.
          </p>
        )}
      </div>
    </div>
  );
}
