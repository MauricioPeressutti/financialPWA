import "server-only";

/** Normaliza un texto para comparar nombres de categoría (sin acentos, minúsculas). */
export function normCat(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join("")
    .trim();
}

type CatLike = {
  id: string;
  name: string;
  subcategories: { id: string; name: string }[];
};

/**
 * Encuentra la categoría de gasto que mejor matchea un nombre.
 * Exacto → parcial → "Otros" → la primera. null si no hay ninguna.
 */
export function resolveCategory<T extends CatLike>(
  cats: T[],
  name: string,
): T | null {
  const n = normCat(name);
  let cat = cats.find((c) => normCat(c.name) === n);
  if (!cat && n) cat = cats.find((c) => normCat(c.name).includes(n));
  if (!cat && n) cat = cats.find((c) => n.includes(normCat(c.name)));
  if (!cat) cat = cats.find((c) => normCat(c.name) === "otros") ?? cats[0];
  return cat ?? null;
}

/** Subcategoría de `cat` cuyo nombre matchea, o null. */
export function resolveSubcategory<T extends CatLike>(
  cat: T | null,
  name: string,
): T["subcategories"][number] | null {
  if (!cat || !name) return null;
  const n = normCat(name);
  return (
    cat.subcategories.find((s) => normCat(s.name) === n) ??
    cat.subcategories.find((s) => normCat(s.name).includes(n)) ??
    null
  );
}
