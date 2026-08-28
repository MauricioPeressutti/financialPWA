import { IncomeForm } from "@/components/income-form";
import { requireTeam } from "@/lib/auth";
import { getFxContext } from "@/lib/fx";
import { getActiveCategories } from "@/lib/queries";

export default async function NewIncomePage() {
  const { team } = await requireTeam();
  const [categories, fx] = await Promise.all([
    getActiveCategories(team.id, "income"),
    getFxContext(team),
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
      />
    </div>
  );
}
