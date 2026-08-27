import { notFound } from "next/navigation";

import { IncomeForm } from "@/components/income-form";
import { requireTeam } from "@/lib/auth";
import { getActiveCategories, getIncome } from "@/lib/queries";

export default async function EditIncomePage({
  params,
}: PageProps<"/incomes/[id]/edit">) {
  const { team } = await requireTeam();
  const { id } = await params;

  const [income, categories] = await Promise.all([
    getIncome(team.id, id),
    getActiveCategories(team.id, "income"),
  ]);
  if (!income) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Editar ingreso</h1>
      <IncomeForm
        categories={categories}
        income={{
          id: income.id,
          amount: (income.amountCents / 100).toFixed(2),
          receivedOn: income.receivedOn,
          categoryId: income.categoryId,
          subcategoryId: income.subcategoryId,
          method: income.method,
          description: income.description,
        }}
      />
    </div>
  );
}
