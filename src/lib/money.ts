const fmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

/** 123456 (centavos) -> "$ 1.234,56" */
export function formatCents(cents: number): string {
  return fmt.format(cents / 100);
}

/** "1.234,56" o "1234.56" -> 123456 (centavos). Devuelve null si no parsea. */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/\s/g, "")
    .replace(/[$]/g, "");
  if (!cleaned) return null;

  // Normaliza formato AR (1.234,56) y US (1,234.56)
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  debito: "Débito",
  credito: "Crédito",
};
