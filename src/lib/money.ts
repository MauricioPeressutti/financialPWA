const fmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

/** 123456 (centavos) -> "$ 1.234,56" (pesos) */
export function formatCents(cents: number): string {
  return fmt.format(cents / 100);
}

const plainFmt = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Igual que formatCents pero según la moneda. 123456,"USD" -> "US$ 1.234,56" */
export function formatMoney(cents: number, currency = "ARS"): string {
  if (currency === "ARS") return formatCents(cents);
  const sym = currency === "USD" ? "US$" : currency === "EUR" ? "€" : currency;
  return `${sym} ${plainFmt.format(cents / 100)}`;
}

/** "1.234,56" · "1234.56" · "1.000.000" -> centavos. null si no parsea. */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, "").replace(/[$]/g, "");
  if (!cleaned || !/\d/.test(cleaned)) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;

  if (hasComma && hasDot) {
    // el separador más a la derecha es el decimal
    normalized =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".") // AR: 1.234,56
        : cleaned.replace(/,/g, ""); // US: 1,234.56
  } else if (hasComma) {
    // coma = decimal (AR); un punto suelto acá no debería pasar
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    const parts = cleaned.split(".");
    // varios puntos, o un punto con exactamente 3 dígitos detrás y algo delante
    // distinto de "0" => son separadores de miles (1.000 / 1.000.000)
    const thousands =
      parts.length > 2 ||
      (parts.length === 2 &&
        parts[1].length === 3 &&
        parts[0].length >= 1 &&
        parts[0] !== "0");
    normalized = thousands ? cleaned.replace(/\./g, "") : cleaned;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/**
 * Formatea progresivamente lo que se tipea en un input de monto, es-AR:
 * "1000000" -> "1.000.000" · "2500,5" -> "2.500,5" · "1234.56" -> "1.234,56"
 * Idempotente (re-formatear su propia salida da lo mismo).
 */
export function formatAmountInput(raw: string): string {
  let s = raw.replace(/[^\d.,]/g, "");
  // un "." como decimal solo si es el único separador con 1-2 dígitos detrás
  s = s.replace(/^(\d+)\.(\d{1,2})$/, "$1,$2");
  s = s.replace(/\./g, ""); // el resto de puntos = miles, se recalculan
  const firstComma = s.indexOf(",");
  if (firstComma !== -1) {
    s = s.slice(0, firstComma + 1) + s.slice(firstComma + 1).replace(/,/g, "");
  }
  const hasComma = s.includes(",");
  const [rawInt, decPart = ""] = s.split(",");
  const intPart = rawInt.replace(/^0+(?=\d)/, "");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (!hasComma) return grouped;
  return `${grouped || "0"},${decPart.slice(0, 2)}`;
}

/** centavos -> string para prellenar un input de monto ("1.234,56"). */
export function centsToAmountInput(cents: number): string {
  return formatAmountInput((cents / 100).toFixed(2));
}
