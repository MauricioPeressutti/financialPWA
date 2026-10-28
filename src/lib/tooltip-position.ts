/**
 * Posición horizontal (`left`, en px) de un tooltip absoluto dentro de su
 * contenedor: a la derecha del puntero (`x + offset`) si entra; si no, se
 * ajusta para que quede entero dentro (`0 <= left <= containerWidth - tipWidth`).
 * Si el tooltip es más ancho que el contenedor, devuelve 0.
 */
export function clampTooltipLeft(
  x: number,
  containerWidth: number,
  tipWidth: number,
  offset = 12,
): number {
  const maxLeft = containerWidth - tipWidth;
  if (maxLeft <= 0) return 0;
  return Math.min(Math.max(x + offset, 0), maxLeft);
}
