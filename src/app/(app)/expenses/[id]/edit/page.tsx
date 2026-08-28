import { notFound } from "next/navigation";

import { ExpenseForm } from "@/components/expense-form";
import { requireTeam } from "@/lib/auth";
import { getFxContext } from "@/lib/fx";
import { getActiveCategories, getExpense } from "@/lib/queries";

export default async function EditExpensePage({
  params,
}: PageProps<"/expenses/[id]/edit">) {
  const { team } = await requireTeam();
  const { id } = await params;

  const [expense, categories, fx] = await Promise.all([
    getExpense(team.id, id),
    getActiveCategories(team.id, "expense"),
    getFxContext(team),
  ]);
  if (!expense) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Editar gasto</h1>
      <ExpenseForm
        categories={categories}
        primaryCurrency={fx.primaryCurrency}
        currencies={fx.currencies}
        usdArsRate={fx.usdArsRate}
        fxReferenceLabel={fx.fxReferenceLabel}
        expense={{
          id: expense.id,
          amount: (expense.amountCents / 100).toFixed(2),
          currency: expense.currency,
          fxRate: expense.fxRate,
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
