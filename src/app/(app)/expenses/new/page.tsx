import { ExpenseForm } from "@/components/expense-form";
import { requireTeam } from "@/lib/auth";
import { getActiveCategories } from "@/lib/queries";

export default async function NewExpensePage() {
  const { team } = await requireTeam();
  const categories = await getActiveCategories(team.id);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Nuevo gasto</h1>
      <ExpenseForm categories={categories} />
    </div>
  );
}
