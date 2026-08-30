// Bits puros (sin DB) — se pueden importar desde componentes cliente.

export type AnalyticsRange = "1w" | "1m" | "3m" | "6m";

export const RANGE_ORDER: AnalyticsRange[] = ["1w", "1m", "3m", "6m"];

export const RANGE_LABELS: Record<AnalyticsRange, string> = {
  "1w": "1 semana",
  "1m": "1 mes",
  "3m": "3 meses",
  "6m": "6 meses",
};

export function resolveRange(range: AnalyticsRange): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  switch (range) {
    case "1w":
      from.setDate(from.getDate() - 7);
      break;
    case "1m":
      from.setMonth(from.getMonth() - 1);
      break;
    case "3m":
      from.setMonth(from.getMonth() - 3);
      break;
    case "6m":
      from.setMonth(from.getMonth() - 6);
      break;
  }
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}
