export const CURRENCIES = ["ARS", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

type Meta = {
  code: Currency;
  label: string;
  symbol: string;
  /** decimales al mostrar */
  decimals: number;
};

export const currencyMeta: Record<Currency, Meta> = {
  ARS: { code: "ARS", label: "Pesos", symbol: "$", decimals: 0 },
  USD: { code: "USD", label: "Dólares", symbol: "US$", decimals: 2 },
  EUR: { code: "EUR", label: "Euros", symbol: "€", decimals: 2 },
};

export function isCurrency(v: unknown): v is Currency {
  return typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);
}

/** Referencias de cotización del dólar (Argentina). */
export const FX_REFERENCES = ["blue", "oficial", "mep", "cripto"] as const;
export type FxReference = (typeof FX_REFERENCES)[number];

export const fxReferenceLabel: Record<FxReference, string> = {
  blue: "Blue",
  oficial: "Oficial",
  mep: "MEP",
  cripto: "Cripto",
};
