"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCategory,
  createSubcategory,
  setCategoryArchived,
  setSubcategoryArchived,
} from "@/lib/actions/categories";

type Sub = { id: string; name: string; archived: boolean };
type Cat = { id: string; name: string; archived: boolean; subcategories: Sub[] };

export function CategoryManager({
  categories,
  canEdit,
}: {
  categories: Cat[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newCat, setNewCat] = useState("");
  const [subDraft, setSubDraft] = useState<Record<string, string>>({});

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {canEdit && (
        <div className="flex gap-2">
          <Input
            placeholder="Nueva categoría"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
          />
          <Button
            disabled={pending || !newCat.trim()}
            onClick={() =>
              run(async () => {
                const r = await createCategory({ name: newCat });
                if (r.ok) setNewCat("");
                return r;
              })
            }
          >
            Agregar
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className={cat.archived ? "opacity-50" : undefined}
          >
            <div className="flex items-center justify-between border-b pb-1">
              <span className="font-medium">{cat.name}</span>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={pending}
                  onClick={() =>
                    run(() => setCategoryArchived(cat.id, !cat.archived))
                  }
                >
                  {cat.archived ? "Reactivar" : "Archivar"}
                </Button>
              )}
            </div>

            <ul className="mt-1.5 space-y-1 pl-3 text-sm">
              {cat.subcategories.map((sub) => (
                <li
                  key={sub.id}
                  className={`flex items-center justify-between ${sub.archived ? "opacity-50" : ""}`}
                >
                  <span>{sub.name}</span>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={pending}
                      onClick={() =>
                        run(() => setSubcategoryArchived(sub.id, !sub.archived))
                      }
                    >
                      {sub.archived ? "Reactivar" : "Archivar"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>

            {canEdit && !cat.archived && (
              <div className="mt-2 flex gap-2 pl-3">
                <Input
                  className="h-7"
                  placeholder="Nueva subcategoría"
                  value={subDraft[cat.id] ?? ""}
                  onChange={(e) =>
                    setSubDraft((d) => ({ ...d, [cat.id]: e.target.value }))
                  }
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending || !(subDraft[cat.id] ?? "").trim()}
                  onClick={() =>
                    run(async () => {
                      const r = await createSubcategory({
                        categoryId: cat.id,
                        name: subDraft[cat.id] ?? "",
                      });
                      if (r.ok) setSubDraft((d) => ({ ...d, [cat.id]: "" }));
                      return r;
                    })
                  }
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
