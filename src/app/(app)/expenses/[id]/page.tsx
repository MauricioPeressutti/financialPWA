import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DeleteExpenseButton } from "@/components/delete-expense-button";
import { ReimbursementSection } from "@/components/reimbursement-section";
import { requireTeam } from "@/lib/auth";
import { formatCents, formatMoney } from "@/lib/money";
import { fmtDateTime } from "@/lib/datetime";
import { currencyMeta, type Currency } from "@/lib/currencies";
import { paymentMethodLabels } from "@/lib/payment-methods";
import { getExpense } from "@/lib/queries";

export default async function ExpenseDetailPage({
  params,
}: PageProps<"/expenses/[id]">) {
  const { team } = await requireTeam();
  const { id } = await params;
  const expense = await getExpense(team.id, id);
  if (!expense) notFound();

  const reimbursed = expense.reimbursements.reduce((a, r) => a + r.amountCents, 0);
  const net = expense.amountCents - reimbursed;
  const cur = expense.currency;
  const foreign = cur !== team.primaryCurrency;
  const m = (c: number) => formatMoney(c, cur);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Gasto</h1>
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/expenses/${id}/edit`}>Editar</Link>}
        />
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-3xl font-bold">{m(expense.amountCents)}</p>
        {foreign && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            ≈ {formatCents(expense.baseAmountCents)} al cargar
          </p>
        )}
        {reimbursed > 0 && (
          <p className="mt-1 text-sm text-emerald-600">
            Reintegrado {m(reimbursed)} · neto {m(net)}
          </p>
        )}
        <dl className="mt-4 space-y-1.5 text-sm">
          <Row k="Fecha" v={expense.spentOn} />
          <Row
            k="Categoría"
            v={`${expense.categoryName}${expense.subcategoryName ? ` · ${expense.subcategoryName}` : ""}`}
          />
          <Row k="Forma de pago" v={paymentMethodLabels[expense.paymentMethod]} />
          {foreign && (
            <>
              <Row
                k="Tipo de cambio"
                v={`1 ${cur} = ${formatCents(Math.round(expense.fxRate * 100))}`}
              />
              <Row
                k="Equivalente"
                v={`${formatCents(expense.baseAmountCents)} (${currencyMeta[team.primaryCurrency as Currency]?.label ?? team.primaryCurrency})`}
              />
            </>
          )}
          {expense.description && <Row k="Descripción" v={expense.description} />}
          <Row
            k="Cargado"
            v={`${fmtDateTime(expense.createdAt)}${
              expense.createdBy ? ` · ${expense.createdBy}` : ""
            }`}
          />
        </dl>
      </div>

      <ReimbursementSection
        expenseId={id}
        reimbursements={expense.reimbursements.map((r) => ({
          id: r.id,
          amountCents: r.amountCents,
          note: r.note,
          reimbursedOn: r.reimbursedOn,
        }))}
      />

      <DeleteExpenseButton id={id} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
