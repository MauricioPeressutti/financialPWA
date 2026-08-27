import { notFound } from "next/navigation";

import { ExpenseForm } from "@/components/expense-form";
import { requireTeam } from "@/lib/auth";
import { getActiveCategories, getExpense } from "@/lib/queries";

export default async function EditExpensePage({
  params,
}: PageProps<"/expenses/[id]/edit">) {
  const { team } = await requireTeam();
  const { id } = await params;

  const [expense, categories] = await Promise.all([
    getExpense(team.id, id),
    getActiveCategories(team.id),
  ]);
  if (!expense) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Editar gasto</h1>
      <ExpenseForm
        categories={categories}
        expense={{
          id: expense.id,
          amount: (expense.amountCents / 100).toFixed(2),
          spentOn: expense.spentOn,
          categoryId: expense.categoryId,
          subcategoryId: expense.subcategoryId,
          paymentMethod: expense.paymentMethod,
          description: expense.description,
        }}
      />
    </div>
  );
}
