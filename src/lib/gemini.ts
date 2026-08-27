import "server-only";

import { PAYMENT_METHODS, paymentMethodMeta } from "@/lib/payment-methods";

// Se puede sobreescribir con la env var GEMINI_MODEL sin tocar el código.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export type ParsedExpense = {
  amount: number | null;
  category: string;
  subcategory: string;
  paymentMethod: string;
  description: string;
  reimbursed: number;
  spentOn: string;
  confidence: "alta" | "media" | "baja";
  note?: string;
};

type CategoryTree = { name: string; subcategories: { name: string }[] }[];

export async function parseExpenseMessage(
  text: string,
  opts: { categories: CategoryTree; today: string },
): Promise<ParsedExpense | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY");

  const catList = opts.categories
    .map(
      (c) =>
        `- ${c.name}${
          c.subcategories.length
            ? ` (subcategorías: ${c.subcategories.map((s) => s.name).join(", ")})`
            : ""
        }`,
    )
    .join("\n");

  const methods = PAYMENT_METHODS.map(
    (m) => `${m} = ${paymentMethodMeta[m].label}`,
  ).join(", ");

  const system = [
    "Sos un extractor de gastos para una app de finanzas familiar en Argentina.",
    "A partir de un mensaje en español rioplatense, devolvés SOLO el JSON pedido.",
    `Hoy es ${opts.today} (zona horaria America/Argentina/Buenos_Aires).`,
    "",
    "Categorías disponibles (usá el nombre EXACTO, o \"\" si ninguna encaja):",
    catList,
    "",
    `Formas de pago válidas: ${methods}.`,
    "Sinónimos: \"débito\"/\"la tarjeta\"=debito, \"crédito\"/\"cuotas\"=credito,",
    "\"modo\"=modo_debito salvo que diga crédito, \"mercado pago\"/\"la de meli\"/\"mp\"=mercadopago,",
    "\"efectivo\"/\"cash\"/\"plata\"=efectivo. Si no se aclara, usá \"efectivo\".",
    "",
    "Reglas:",
    "- amount: monto en pesos, solo el número (5.300 -> 5300). null si no hay monto.",
    "- reimbursed: monto que le devolvieron/reintegraron. 0 si no hubo.",
    "- spentOn: fecha YYYY-MM-DD. \"ayer\", \"el lunes\", etc. -> calculala. Si no dice nada -> hoy.",
    "- description: detalle corto y opcional (ej: \"chino\", \"nafta\").",
    "- confidence: \"alta\" si monto y categoría claros; \"media\" si alguno es inferencia; \"baja\" si dudás.",
    "- note: solo si confidence no es alta, una línea explicando qué falta o qué asumiste.",
  ].join("\n");

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          amount: { type: "number", nullable: true },
          category: { type: "string" },
          subcategory: { type: "string" },
          paymentMethod: { type: "string" },
          description: { type: "string" },
          reimbursed: { type: "number" },
          spentOn: { type: "string" },
          confidence: { type: "string", enum: ["alta", "media", "baja"] },
          note: { type: "string" },
        },
        required: ["amount", "category", "paymentMethod", "confidence"],
      },
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
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!jsonText) return null;

  try {
    const p = JSON.parse(jsonText) as Partial<ParsedExpense>;
    return {
      amount: typeof p.amount === "number" ? p.amount : null,
      category: p.category ?? "",
      subcategory: p.subcategory ?? "",
      paymentMethod: p.paymentMethod ?? "efectivo",
      description: p.description ?? "",
      reimbursed: typeof p.reimbursed === "number" ? p.reimbursed : 0,
      spentOn: p.spentOn ?? opts.today,
      confidence: (p.confidence as ParsedExpense["confidence"]) ?? "baja",
      note: p.note,
    };
  } catch {
    return null;
  }
}
