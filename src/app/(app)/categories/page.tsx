import { CategoryManager } from "@/components/category-manager";
import { requireTeam } from "@/lib/auth";
import { getAllCategories } from "@/lib/queries";

export default async function CategoriesPage() {
  const { user, team } = await requireTeam();
  const categories = await getAllCategories(team.id);
  const isOwner = team.role === "owner" || team.ownerUserId === user.id;

  const toProps = (c: (typeof categories)[number]) => ({
    id: c.id,
    name: c.name,
    archived: c.archived,
    subcategories: c.subcategories.map((s) => ({
      id: s.id,
      name: s.name,
      archived: s.archived,
    })),
  });

  const expense = categories.filter((c) => c.kind === "expense").map(toProps);
  const income = categories.filter((c) => c.kind === "income").map(toProps);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Categorías</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Gastos</h2>
        <CategoryManager canEdit={isOwner} kind="expense" categories={expense} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Ingresos (fuentes)
        </h2>
        <CategoryManager canEdit={isOwner} kind="income" categories={income} />
      </section>
    </div>
  );
}
