import { ExpenseForm } from "@/components/expense-form";
import { requireTeam } from "@/lib/auth";
import { getFxContext } from "@/lib/fx";
import { getActiveCategories, getSplitMembers } from "@/lib/queries";

export default async function NewExpensePage() {
  const { team } = await requireTeam();
  const [categories, fx, members] = await Promise.all([
    getActiveCategories(team.id, "expense"),
    getFxContext(team),
    getSplitMembers(team.id),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Nuevo gasto</h1>
      <ExpenseForm
        categories={categories}
        primaryCurrency={fx.primaryCurrency}
        currencies={fx.currencies}
        usdArsRate={fx.usdArsRate}
        fxReferenceLabel={fx.fxReferenceLabel}
        effortEnabled={team.effortEnabled}
        members={members.map((m) => ({
          userId: m.userId,
          name: m.name,
          incomeCents: m.incomeCents,
        }))}
      />
    </div>
  );
}
