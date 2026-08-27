// Bits puros (sin DB) — se pueden importar desde componentes cliente.

export type AnalyticsRange = "1m" | "3m" | "6m" | "1y" | "all";

export const RANGE_ORDER: AnalyticsRange[] = ["1m", "3m", "6m", "1y", "all"];

export const RANGE_LABELS: Record<AnalyticsRange, string> = {
  "1m": "1M",
  "3m": "3M",
  "6m": "6M",
  "1y": "1A",
  all: "Todo",
};

export function resolveRange(range: AnalyticsRange): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  switch (range) {
    case "1m":
      from.setMonth(from.getMonth() - 1);
      break;
    case "3m":
      from.setMonth(from.getMonth() - 3);
      break;
    case "6m":
      from.setMonth(from.getMonth() - 6);
      break;
    case "1y":
      from.setFullYear(from.getFullYear() - 1);
      break;
    case "all":
      return { from: "1970-01-01", to: to.toISOString().slice(0, 10) };
  }
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}
