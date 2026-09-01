import "server-only";

import { PAYMENT_METHODS, paymentMethodMeta } from "@/lib/payment-methods";
import { INCOME_METHODS, incomeMethodMeta } from "@/lib/income-methods";

// Se puede sobreescribir con la env var GEMINI_MODEL sin tocar el código.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export type ParsedMovement = {
  kind: "gasto" | "ingreso";
  kindClear: boolean; // false => hay que preguntarle al usuario
  amount: number | null;
  currency: "ARS" | "USD" | "EUR";
  category: string;
  subcategory: string;
  paymentMethod: string; // gasto: forma de pago · ingreso: medio
  description: string;
  reimbursed: number; // solo gasto
  spentOn: string; // fecha del movimiento (YYYY-MM-DD)
  confidence: "alta" | "media" | "baja";
  note?: string;
};

// Compat con el nombre anterior.
export type ParsedExpense = ParsedMovement;

type CategoryTree = { name: string; subcategories: { name: string }[] }[];

const fmtTree = (t: CategoryTree) =>
  t
    .map(
      (c) =>
        `- ${c.name}${
          c.subcategories.length
            ? ` (subcategorías: ${c.subcategories.map((s) => s.name).join(", ")})`
            : ""
        }`,
    )
    .join("\n") || "- (ninguna)";

type ParseOpts = {
  expenseCategories: CategoryTree;
  incomeCategories: CategoryTree;
  today: string;
};

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

function buildSystemPrompt(opts: ParseOpts, receipt: boolean): string {
  const payMethods = PAYMENT_METHODS.map(
    (m) => `${m} = ${paymentMethodMeta[m].label}`,
  ).join(", ");
  const incMethods = INCOME_METHODS.map(
    (m) => `${m} = ${incomeMethodMeta[m].label}`,
  ).join(", ");

  const system = [
    "Sos un extractor de movimientos para una app de finanzas familiar en Argentina.",
    "A partir de un mensaje en español rioplatense, devolvés SOLO el JSON pedido.",
    `Hoy es ${opts.today} (zona horaria America/Argentina/Buenos_Aires).`,
    "",
    "PRIMERO decidí el tipo:",
    '- "ingreso": entró plata. Señales: "cobré", "me pagaron", "me depositaron", "entró",',
    '  "vendí", "sueldo", "aguinaldo", "me transfirieron", "factura cobrada".',
    '- "gasto": salió plata. Señales: "gasté", "pagué", "compré", "saqué", "me salió",',
    '  o un rubro típico de gasto ("super", "nafta", "farmacia", "receta", "bar").',
    'kindClear = true SOLO si hay un verbo o una palabra que deja claro el tipo.',
    'Si el mensaje es solo "<monto> <cosa>" sin verbo y la cosa podría ser cobro o gasto',
    '(ej: "5 en una receta", "8000 clase de inglés", "3000 Juan"), poné kind = "gasto" y kindClear = false.',
    "",
    'Categorías de GASTO (usá el nombre EXACTO, o "" si ninguna encaja):',
    fmtTree(opts.expenseCategories),
    "",
    'Fuentes de INGRESO (usá el nombre EXACTO, o "" si ninguna encaja):',
    fmtTree(opts.incomeCategories),
    "",
    `Si es gasto, paymentMethod es la forma de pago: ${payMethods}.`,
    '  Sinónimos: "débito"/"la tarjeta"=debito, "crédito"/"cuotas"=credito,',
    '  "modo"=modo_debito salvo que diga crédito, "mercado pago"/"la de meli"/"mp"=mercadopago,',
    '  "efectivo"/"cash"/"plata"=efectivo.',
    `Si es ingreso, paymentMethod es el medio: ${incMethods}.`,
    '  Sinónimos: "transferencia"/"me transfirieron"/"cvu"=transferencia, "en mano"/"cash"=efectivo,',
    '  "mp"/"mercado pago"=mercadopago.',
    'IMPORTANTE: si el mensaje NO aclara la forma de pago / medio, devolvé paymentMethod = "". No lo adivines.',
    "",
    "Moneda (currency): ARS por defecto. USD si dice \"usd\", \"u$s\", \"dólares\", \"dolares\",",
    '  "verdes", "green". EUR si dice "euros"/"eur". El número va sin la moneda.',
    "",
    "Reglas:",
    "- amount: solo el número (5.300 -> 5300, 12,99 -> 12.99). null si no hay monto.",
    "- reimbursed: solo para gasto, monto que le devolvieron/reintegraron. 0 si no hubo o es ingreso.",
    '- spentOn: fecha YYYY-MM-DD. "ayer", "el lunes", etc. -> calculala. Sin fecha -> hoy.',
    '- description: detalle corto y opcional (ej: "chino", "nafta", "sueldo agosto").',
    '- confidence: "alta" si monto y categoría claros; "media" si alguno es inferencia; "baja" si dudás.',
    "- note: solo si confidence no es alta, una línea con qué falta o qué asumiste.",
  ];

  if (receipt) {
    system.push(
      "",
      "TE MANDAN UN COMPROBANTE (foto, PDF, o el texto extraído de un PDF): ticket, factura, resumen, captura de transferencia.",
      "- Casi siempre es un GASTO (kind='gasto', kindClear=true). Solo es ingreso si el comprobante",
      "  dice claramente que a vos te acreditaron/pagaron.",
      "- amount = el TOTAL pagado (no un ítem suelto). Si hay varios totales, el mayor / el final.",
      "  Formato argentino: punto = miles, coma = decimales ('$ 12.500,00' = 12500).",
      "  El texto de un PDF suele PERDER la coma de decimales: '$ 8.74092' = 8.740,92 = 8740.92",
      "  (sacás los puntos de miles y los últimos 2 dígitos son centavos). '$ 8.740' sin coma = 8740.",
      "  Si el total está algo borroso pero se intuye, dá tu mejor lectura con confidence='baja'.",
      "- spentOn = la fecha impresa en el comprobante (YYYY-MM-DD). Si no se ve, hoy.",
      "- description = el nombre del comercio/local.",
      "- paymentMethod: si el comprobante muestra el medio (VISA/MASTERCARD/tarjeta, DÉBITO,",
      "  CRÉDITO, MODO, MERCADO PAGO/MERCADOPAGO, EFECTIVO), usalo. Si no se ve, dejá \"\".",
      "- currency: si dice USD/U$S/dólares -> USD; si no, ARS.",
      "- Si la imagen NO es un comprobante o no podés leer el monto, amount = null.",
      "- confidence: \"alta\" solo si el total se lee nítido.",
    );
  }

  return system.join("\n");
}

/**
 * Llama a Gemini pidiéndole JSON con un `responseSchema` y devuelve el objeto
 * parseado (o null si no vino texto / no parsea). Reutilizable para cualquier
 * extractor (movimientos, resúmenes de tarjeta, etc.).
 */
export async function geminiJson<T>(
  system: string,
  parts: GeminiPart[],
  responseSchema: Record<string, unknown>,
  { temperature = 0.1, tag = "gemini" }: { temperature?: number; tag?: string } = {},
): Promise<T | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY");

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
      responseSchema,
    },
  };

  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      finishReason?: string;
    }[];
    promptFeedback?: { blockReason?: string };
  };
  const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!jsonText) {
    console.error(`${tag}: sin texto`, {
      finishReason: data.candidates?.[0]?.finishReason,
      blockReason: data.promptFeedback?.blockReason,
    });
    return null;
  }

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    console.error(`${tag}: JSON inválido`, jsonText.slice(0, 300));
    return null;
  }
}

const MOVEMENT_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["gasto", "ingreso"] },
    kindClear: { type: "boolean" },
    amount: { type: "number", nullable: true },
    currency: { type: "string", enum: ["ARS", "USD", "EUR"] },
    category: { type: "string" },
    subcategory: { type: "string" },
    paymentMethod: { type: "string" },
    description: { type: "string" },
    reimbursed: { type: "number" },
    spentOn: { type: "string" },
    confidence: { type: "string", enum: ["alta", "media", "baja"] },
    note: { type: "string" },
  },
  required: [
    "kind",
    "kindClear",
    "amount",
    "currency",
    "category",
    "paymentMethod",
    "confidence",
  ],
};

async function callGemini(
  system: string,
  parts: GeminiPart[],
  today: string,
): Promise<ParsedMovement | null> {
  const p = await geminiJson<Partial<ParsedMovement>>(
    system,
    parts,
    MOVEMENT_SCHEMA,
  );
  if (!p) return null;

  if (typeof p.amount !== "number") {
    console.error("gemini: amount null", JSON.stringify(p).slice(0, 300));
  }
  return {
    kind: p.kind === "ingreso" ? "ingreso" : "gasto",
    kindClear: p.kindClear !== false,
    amount: typeof p.amount === "number" ? p.amount : null,
    currency: p.currency === "USD" || p.currency === "EUR" ? p.currency : "ARS",
    category: p.category ?? "",
    subcategory: p.subcategory ?? "",
    paymentMethod: p.paymentMethod ?? "",
    description: p.description ?? "",
    reimbursed: typeof p.reimbursed === "number" ? p.reimbursed : 0,
    spentOn: p.spentOn ?? today,
    confidence: (p.confidence as ParsedMovement["confidence"]) ?? "baja",
    note: p.note,
  };
}

export function parseExpenseMessage(
  text: string,
  opts: ParseOpts,
): Promise<ParsedMovement | null> {
  return callGemini(
    buildSystemPrompt(opts, false),
    [{ text }],
    opts.today,
  );
}

/** Extrae el movimiento de la foto/PDF de un comprobante. */
export function parseReceiptImage(
  file: { base64: string; mimeType: string; caption?: string },
  opts: ParseOpts,
): Promise<ParsedMovement | null> {
  const parts: GeminiPart[] = [
    { inlineData: { mimeType: file.mimeType, data: file.base64 } },
    {
      text:
        file.caption?.trim() ||
        "Extraé el movimiento de este comprobante.",
    },
  ];
  return callGemini(buildSystemPrompt(opts, true), parts, opts.today);
}

/** Extrae el movimiento del texto de un comprobante (capa de texto de un PDF). */
export function parseReceiptText(
  pdfText: string,
  opts: ParseOpts & { caption?: string },
): Promise<ParsedMovement | null> {
  const text = [
    "Texto extraído de un comprobante en PDF:",
    "---",
    pdfText.slice(0, 6000),
    "---",
    opts.caption ? `Aclaración del usuario: ${opts.caption}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return callGemini(buildSystemPrompt(opts, true), [{ text }], opts.today);
}
