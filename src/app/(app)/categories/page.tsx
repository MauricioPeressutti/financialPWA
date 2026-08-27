import { CategoryManager } from "@/components/category-manager";
import { requireTeam } from "@/lib/auth";
import { getAllCategories } from "@/lib/queries";

export default async function CategoriesPage() {
  const { user, team } = await requireTeam();
  const categories = await getAllCategories(team.id);
  const isOwner = team.role === "owner" || team.ownerUserId === user.id;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Categorías</h1>
      <CategoryManager
        canEdit={isOwner}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          archived: c.archived,
          subcategories: c.subcategories.map((s) => ({
            id: s.id,
            name: s.name,
            archived: s.archived,
          })),
        }))}
      />
    </div>
  );
}
