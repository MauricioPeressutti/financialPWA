import { MovimientosTabs } from "@/components/movimientos-tabs";
import { NewFixedBillButton } from "@/components/fijos/fixed-bill-form";
import { ArchivedBillRow, FixedBillRow } from "@/components/fijos/fixed-bill-row";
import { FixedMonthPicker } from "@/components/fijos/month-picker";
import { requireTeam } from "@/lib/auth";
import {
  billStatus,
  maxSelectablePeriod,
  monthSummary,
  parsePeriod,
  sortMonthItems,
  todayAR,
} from "@/lib/fixed-bills";
import {
  getCategoryNames,
  listFixedBillsForMonth,
  listUserFixedBills,
  listWindowExpenses,
} from "@/lib/fixed-bills-queries";
import { formatMoney } from "@/lib/money";
import { getActiveCategories } from "@/lib/queries";

export default async function FijosPage({
  searchParams,
}: PageProps<"/movimientos/fijos">) {
  const { user, team } = await requireTeam();
  const sp = await searchParams;

  const today = todayAR();
  const max = maxSelectablePeriod(today);
  const requested = parsePeriod(typeof sp.mes === "string" ? sp.mes : undefined);
  const period = requested > max ? max : requested;

  const [rows, allBills, categories, categoryNames, windowExpenses] = await Promise.all([
    listFixedBillsForMonth(team.id, user.id, period),
    listUserFixedBills(team.id, user.id),
    getActiveCategories(team.id, "expense"),
    getCategoryNames(team.id),
    listWindowExpenses(team.id, period),
  ]);

  const items = sortMonthItems(rows, period, today);
  const summary = monthSummary(rows);
  const currencyLines = Object.entries(summary.byCurrency);
  const archived = allBills.filter((b) => !b.active);

  const currencies = team.currencies?.length ? team.currencies : [team.primaryCurrency];
  const formProps = {
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    currencies,
    primaryCurrency: team.primaryCurrency,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Movimientos</h1>
        <NewFixedBillButton {...formProps} />
      </div>

      <MovimientosTabs />

      {allBills.length === 0 ? (
        <div className="cosmic-panel rounded-2xl border p-6 text-center">
          <p className="text-3xl">🧾</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Todavía no cargaste gastos fijos. Agregá el teléfono, internet, el gimnasio…
          </p>
          <NewFixedBillButton {...formProps} className="mt-4" />
        </div>
      ) : (
        <>
          <FixedMonthPicker period={period} max={max} />

          {items.length > 0 && (
            <div className="space-y-0.5 rounded-lg bg-muted px-3 py-2 text-sm">
              {currencyLines.length <= 1 ? (
                <p>
                  {summary.paidCount} de {summary.total} pagados
                  {currencyLines.map(([cur, v]) => (
                    <span key={cur}>
                      {" · "}
                      {formatMoney(v.paidCents, cur)} pagado · {formatMoney(v.pendingCents, cur)}{" "}
                      pendiente
                    </span>
                  ))}
                </p>
              ) : (
                <>
                  <p className="font-medium">
                    {summary.paidCount} de {summary.total} pagados
                  </p>
                  {currencyLines.map(([cur, v]) => (
                    <p key={cur}>
                      {formatMoney(v.paidCents, cur)} pagado · {formatMoney(v.pendingCents, cur)}{" "}
                      pendiente
                    </p>
                  ))}
                </>
              )}
            </div>
          )}

          <div className="divide-y">
            {items.map((item) => (
              <FixedBillRow
                key={item.bill.id}
                item={item}
                status={billStatus(item.bill, item.payment, period, today)}
                period={period}
                today={today}
                windowExpenses={windowExpenses}
                categoryNames={categoryNames}
                {...formProps}
              />
            ))}
            {items.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No tenías fijos en este mes.
              </p>
            )}
          </div>

          {archived.length > 0 && (
            <details className="rounded-lg border px-3">
              <summary className="flex min-h-10 cursor-pointer items-center text-sm text-muted-foreground">
                Archivados ({archived.length})
              </summary>
              <div className="divide-y pb-1">
                {archived.map((b) => (
                  <ArchivedBillRow key={b.id} bill={b} {...formProps} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
