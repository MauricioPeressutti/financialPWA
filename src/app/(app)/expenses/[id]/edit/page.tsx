import { notFound } from "next/navigation";

import { ExpenseForm } from "@/components/expense-form";
import { requireTeam } from "@/lib/auth";
import { getFxContext } from "@/lib/fx";
import { centsToAmountInput } from "@/lib/money";
import {
  getActiveCategories,
  getExpense,
  getSplitMembers,
  getUsedEntities,
} from "@/lib/queries";

export default async function EditExpensePage({
  params,
}: PageProps<"/expenses/[id]/edit">) {
  const { team } = await requireTeam();
  const { id } = await params;

  const [expense, categories, fx, members, usedEntities] = await Promise.all([
    getExpense(team.id, id),
    getActiveCategories(team.id, "expense"),
    getFxContext(team),
    getSplitMembers(team.id),
    getUsedEntities(team.id),
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
        effortEnabled={team.effortEnabled}
        usedEntities={usedEntities}
        members={members.map((m) => ({
          userId: m.userId,
          name: m.name,
          incomeCents: m.incomeCents,
        }))}
        expense={{
          id: expense.id,
          amount: centsToAmountInput(expense.amountCents),
          currency: expense.currency,
          fxRate: expense.fxRate,
          spentOn: expense.spentOn,
          categoryId: expense.categoryId,
          subcategoryId: expense.subcategoryId,
          paymentMethod: expense.paymentMethod,
          entity: expense.entity,
          description: expense.description,
          splitMode: expense.splitMode,
          paidByUserId: expense.paidByUserId,
        }}
      />
    </div>
  );
}
