import { IncomeForm } from "@/components/income-form";
import { requireTeam } from "@/lib/auth";
import { getActiveCategories } from "@/lib/queries";

export default async function NewIncomePage() {
  const { team } = await requireTeam();
  const categories = await getActiveCategories(team.id, "income");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Nuevo ingreso</h1>
      <IncomeForm categories={categories} />
    </div>
  );
}
