import { notFound } from "next/navigation";

import { IncomeForm } from "@/components/income-form";
import { requireTeam } from "@/lib/auth";
import { getFxContext } from "@/lib/fx";
import { centsToAmountInput } from "@/lib/money";
import { getActiveCategories, getIncome, getUsedEntities } from "@/lib/queries";

export default async function EditIncomePage({
  params,
}: PageProps<"/incomes/[id]/edit">) {
  const { team } = await requireTeam();
  const { id } = await params;

  const [income, categories, fx, usedEntities] = await Promise.all([
    getIncome(team.id, id),
    getActiveCategories(team.id, "income"),
    getFxContext(team),
    getUsedEntities(team.id),
  ]);
  if (!income) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Editar ingreso</h1>
      <IncomeForm
        categories={categories}
        primaryCurrency={fx.primaryCurrency}
        currencies={fx.currencies}
        usdArsRate={fx.usdArsRate}
        fxReferenceLabel={fx.fxReferenceLabel}
        usedEntities={usedEntities}
        income={{
          id: income.id,
          amount: centsToAmountInput(income.amountCents),
          currency: income.currency,
          fxRate: income.fxRate,
          receivedOn: income.receivedOn,
          categoryId: income.categoryId,
          subcategoryId: income.subcategoryId,
          method: income.method,
          entity: income.entity,
          description: income.description,
        }}
      />
    </div>
  );
}
