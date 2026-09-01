import "server-only";

import { geminiJson } from "@/lib/gemini";

export type StatementKind =
  | "consumo"
  | "cuota"
  | "impuesto"
  | "interes"
  | "pago"
  | "saldo"
  | "ajuste";

export type StatementLine = {
  date: string; // YYYY-MM-DD
  description: string;
  amountCents: number; // siempre positivo, en la moneda de `currency`
  currency: "ARS" | "USD";
  kind: StatementKind;
  installment: string | null; // "3/12" o null
  category: string; // nombre de categoría del equipo, o ""
};

export type ParsedStatement = {
  bank: string;
  brand: string; // visa | mastercard | amex | otro
  last4: string;
  closingDate: string | null; // YYYY-MM-DD
  dueDate: string | null; // YYYY-MM-DD
  totalArsCents: number;
  totalUsdCents: number;
  minPaymentArsCents: number | null;
  lines: StatementLine[];
};

const STATEMENT_KEYS = [
  "vencimiento",
  "cierre",
  "pago minimo",
  "pago mínimo",
  "saldo anterior",
  "limite de compra",
  "límite de compra",
  "resumen de cuenta",
  "estado de cuenta",
  "pago total",
  "su pago",
];

/** Heurística: ¿el texto de este PDF es un resumen de tarjeta y no un comprobante suelto? */
export function looksLikeStatement(text: string): boolean {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  const hits = STATEMENT_KEYS.filter((k) =>
    t.includes(k.normalize("NFD").replace(/\p{Diacritic}/gu, "")),
  ).length;
  return hits >= 3;
}

const cents = (n: unknown) =>
  typeof n === "number" && Number.isFinite(n) ? Math.round(n * 100) : 0;

const ymd = (s: unknown): string | null =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;

type RawLine = {
  date?: string;
  description?: string;
  amount?: number;
  currency?: string;
  kind?: string;
  installment?: string;
  category?: string;
};
type RawStatement = {
  bank?: string;
  brand?: string;
  last4?: string;
  closingDate?: string;
  dueDate?: string;
  totalArs?: number;
  totalUsd?: number;
  minPaymentArs?: number;
  lines?: RawLine[];
};

const SCHEMA = {
  type: "object",
  properties: {
    bank: { type: "string" },
    brand: { type: "string", enum: ["visa", "mastercard", "amex", "otro"] },
    last4: { type: "string" },
    closingDate: { type: "string" },
    dueDate: { type: "string" },
    totalArs: { type: "number" },
    totalUsd: { type: "number" },
    minPaymentArs: { type: "number" },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          description: { type: "string" },
          amount: { type: "number" },
          currency: { type: "string", enum: ["ARS", "USD"] },
          kind: {
            type: "string",
            enum: [
              "consumo",
              "cuota",
              "impuesto",
              "interes",
              "pago",
              "saldo",
              "ajuste",
            ],
          },
          installment: { type: "string" },
          category: { type: "string" },
        },
        required: ["date", "description", "amount", "currency", "kind"],
      },
    },
  },
  required: ["dueDate", "lines"],
};

export type CategoryTree = {
  name: string;
  subcategories: { name: string }[];
}[];

function buildPrompt(categories: CategoryTree, today: string): string {
  const cats =
    categories.map((c) => `- ${c.name}`).join("\n") || "- (ninguna)";
  return [
    "Sos un extractor de resúmenes (estados de cuenta) de tarjeta de crédito de Argentina.",
    "Funciona con CUALQUIER banco: Galicia, Santander, BBVA, Macro, Nación, ICBC, Ciudad,",
    "Credicoop, Supervielle, Patagonia, Comafi, HSBC, Naranja X, Ualá, Brubank, Reba, etc.",
    "Te paso el texto extraído del PDF. Devolvés SOLO el JSON pedido.",
    `Hoy es ${today}.`,
    "",
    "ENCABEZADO:",
    "- bank: el banco emisor. brand: visa/mastercard/amex/otro. last4: últimos 4 dígitos de la tarjeta.",
    '- closingDate: fecha de "Cierre" / "Fecha de cierre" (YYYY-MM-DD).',
    '- dueDate: fecha de "Vencimiento" / "Vto." / "Fecha de pago" / "Paga hasta" (YYYY-MM-DD). Si no la ves, "".',
    '- totalArs: "Total a pagar" / "Saldo actual" / "Pago total" en PESOS. totalUsd: el equivalente en la sección de dólares (0 si no hay).',
    '- minPaymentArs: "Pago mínimo" en pesos (0 si no está).',
    "",
    "LÍNEAS (array `lines`), una por movimiento del detalle:",
    "- date: fecha del movimiento (YYYY-MM-DD). El texto suele traer DD/MM/AA o DD-MMM;",
    "  inferí el año por la fecha de cierre/vencimiento.",
    "- description: el comercio o concepto, corto.",
    "- amount: SIEMPRE positivo, el importe de esa línea, en la moneda de `currency`.",
    "- currency: ARS, salvo que esté en la sección de dólares (US$ / U$S / 'consumos en el exterior') → USD.",
    "- kind:",
    '  · "consumo": compra normal del período.',
    '  · "cuota": compra en cuotas (dice "cuota 03/12", "C.03/12", "3 de 12"). Poné installment = "3/12".',
    '  · "impuesto": IVA, percepción, RG AFIP, impuesto PAÍS, impuesto de sellos, ley 25.413, débitos y créditos.',
    '  · "interes": intereses de financiación, punitorios, cargos financieros.',
    '  · "pago": "SU PAGO", "PAGO RECIBIDO", "PAGO EN PESOS". (no es un gasto)',
    '  · "saldo": "SALDO ANTERIOR", "SALDO PENDIENTE". (no es un gasto)',
    '  · "ajuste": notas de crédito, devoluciones, reintegros, "AJUSTE", "BONIFICACIÓN".',
    "- installment: \"X/Y\" si es cuota, si no \"\".",
    "- category: elegí el nombre EXACTO de esta lista, o \"\" si ninguna encaja:",
    cats,
    "",
    "REGLAS:",
    "- Formato argentino: '1.234,56' = 1234.56 (punto = miles, coma = decimales).",
    "  El texto del PDF a veces PIERDE la coma: '8.74092' = 8.740,92. Usá tu mejor lectura.",
    "- No inventes líneas. Si una fila no tiene importe claro, omitila.",
    "- Incluí TODAS las líneas del detalle, también las de kind pago/saldo/impuesto/interes.",
  ].join("\n");
}

/** Parsea el texto de un resumen de tarjeta con Gemini. */
export async function parseCardStatement(
  pdfText: string,
  opts: { expenseCategories: CategoryTree; today: string },
): Promise<ParsedStatement | null> {
  const text = [
    "Texto extraído de un resumen de tarjeta de crédito en PDF:",
    "---",
    pdfText.slice(0, 40000),
    "---",
  ].join("\n");

  const raw = await geminiJson<RawStatement>(
    buildPrompt(opts.expenseCategories, opts.today),
    [{ text }],
    SCHEMA,
    { tag: "card-statement" },
  );
  if (!raw) return null;

  const validKinds: StatementKind[] = [
    "consumo",
    "cuota",
    "impuesto",
    "interes",
    "pago",
    "saldo",
    "ajuste",
  ];

  const lines: StatementLine[] = (raw.lines ?? [])
    .map((l): StatementLine | null => {
      const amountCents = Math.abs(cents(l.amount));
      if (!amountCents) return null;
      const date = ymd(l.date) ?? raw.closingDate ?? opts.today;
      const kind = validKinds.includes(l.kind as StatementKind)
        ? (l.kind as StatementKind)
        : "consumo";
      const inst =
        typeof l.installment === "string" && /\d+\s*\/\s*\d+/.test(l.installment)
          ? l.installment.replace(/\s+/g, "")
          : null;
      return {
        date,
        description: (l.description ?? "").trim().slice(0, 120) || "Consumo",
        amountCents,
        currency: l.currency === "USD" ? "USD" : "ARS",
        kind: inst && kind === "consumo" ? "cuota" : kind,
        installment: inst,
        category: (l.category ?? "").trim(),
      };
    })
    .filter((l): l is StatementLine => l !== null);

  return {
    bank: (raw.bank ?? "").trim(),
    brand: (raw.brand ?? "").trim().toLowerCase(),
    last4: (raw.last4 ?? "").replace(/\D/g, "").slice(-4),
    closingDate: ymd(raw.closingDate),
    dueDate: ymd(raw.dueDate),
    totalArsCents: cents(raw.totalArs),
    totalUsdCents: cents(raw.totalUsd),
    minPaymentArsCents: raw.minPaymentArs ? cents(raw.minPaymentArs) : null,
    lines,
  };
}

/** "Visa · Galicia · ••1234" a partir de lo parseado. */
export function statementLabel(s: {
  bank: string;
  brand: string;
  last4: string;
}): string {
  const brand =
    { visa: "Visa", mastercard: "Mastercard", amex: "Amex" }[s.brand] ||
    (s.brand ? s.brand[0].toUpperCase() + s.brand.slice(1) : "Tarjeta");
  const parts = [brand];
  if (s.bank) parts.push(s.bank);
  if (s.last4) parts.push(`••${s.last4}`);
  return parts.join(" · ");
}
