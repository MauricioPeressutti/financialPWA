// Paleta de categorías para Análisis. Archivo sin "server-only": lo usan
// tanto Server Components (page.tsx) como el donut, que es Client Component.

// 10 colores rotativos (--cat-0..--cat-9) + "Otros" con un gris dedicado
// (--cat-otros) para que el cajón de sastre no compita por atención.
const ROTATING_COUNT = 10;

/** Índice de color estable para una categoría, según su posición alfabética
 *  dentro de la lista completa. "Otros" (nombre exacto) siempre va a -1,
 *  que catColorVar() resuelve al gris dedicado en vez de rotar con el resto. */
export function buildCategoryColors(allNames: string[]): Record<string, number> {
  const sorted = [...allNames].sort((a, b) => a.localeCompare(b, "es"));
  const map: Record<string, number> = {};
  let i = 0;
  for (const name of sorted) {
    if (/^otros$/i.test(name)) map[name] = -1;
    else {
      map[name] = i % ROTATING_COUNT;
      i++;
    }
  }
  return map;
}

/** Índice de buildCategoryColors -> variable CSS a usar en fill/background. */
export function catColorVar(idx: number | undefined): string {
  return idx === undefined || idx < 0 ? "var(--cat-otros)" : `var(--cat-${idx})`;
}
