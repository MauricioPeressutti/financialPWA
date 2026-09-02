import { IncomeForm } from "@/components/income-form";
import { requireTeam } from "@/lib/auth";
import { getFxContext } from "@/lib/fx";
import { getActiveCategories, getUsedEntities } from "@/lib/queries";

export default async function NewIncomePage() {
  const { team } = await requireTeam();
  const [categories, fx, usedEntities] = await Promise.all([
    getActiveCategories(team.id, "income"),
    getFxContext(team),
    getUsedEntities(team.id),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Nuevo ingreso</h1>
      <IncomeForm
        categories={categories}
        primaryCurrency={fx.primaryCurrency}
        currencies={fx.currencies}
        usdArsRate={fx.usdArsRate}
        fxReferenceLabel={fx.fxReferenceLabel}
        usedEntities={usedEntities}
      />
    </div>
  );
}
