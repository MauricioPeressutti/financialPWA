import { z } from "zod";

import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { INCOME_METHODS } from "@/lib/income-methods";
import { CURRENCIES } from "@/lib/currencies";

const currencyField = z.enum(CURRENCIES);
const fxRateField = z.string().optional().or(z.literal("")); // override manual del TC

export const expenseInput = z.object({
  amount: z.string().min(1, "Ingresá un monto"),
  currency: currencyField,
  fxRate: fxRateField,
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  categoryId: z.string().uuid("Elegí una categoría"),
  subcategoryId: z.string().uuid().optional().or(z.literal("")),
  paymentMethod: z.enum(PAYMENT_METHODS),
  entity: z.string().max(40).optional().or(z.literal("")),
  description: z.string().max(280).optional().or(z.literal("")),
  // Reintegro inmediato opcional (ej: MODO devuelve al toque). Se anota
  // como reintegro del mismo gasto, con la fecha del gasto.
  reimbursedAmount: z.string().optional().or(z.literal("")),
  // Calculadora de esfuerzo
  splitMode: z.enum(["none", "proportional", "even", "custom"]),
  paidByUserId: z.string().uuid().optional().or(z.literal("")),
  splitCustom: z.string().optional().or(z.literal("")), // JSON { userId: pct }
});
export type ExpenseInput = z.infer<typeof expenseInput>;

export const reimbursementInput = z.object({
  expenseId: z.string().uuid(),
  amount: z.string().min(1, "Ingresá un monto"),
  reimbursedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  note: z.string().max(280).optional().or(z.literal("")),
});

export const incomeInput = z.object({
  amount: z.string().min(1, "Ingresá un monto"),
  currency: currencyField,
  fxRate: fxRateField,
  receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  categoryId: z.string().uuid("Elegí una fuente"),
  subcategoryId: z.string().uuid().optional().or(z.literal("")),
  method: z.enum(INCOME_METHODS),
  entity: z.string().max(40).optional().or(z.literal("")),
  description: z.string().max(280).optional().or(z.literal("")),
});
export type IncomeInput = z.infer<typeof incomeInput>;

// Gasto fijo mensual. El monto se parsea aparte con parseAmountToCents.
// userId/teamId del input se descartan (z.object hace strip de claves extra).
export const fixedBillInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Poné un nombre")
    .max(60, "El nombre puede tener hasta 60 caracteres"),
  emoji: z.string().trim().max(16).optional().or(z.literal("")),
  amount: z.string().trim().min(1, "Ingresá un monto"),
  currency: z.string().optional().or(z.literal("")),
  categoryId: z
    .string()
    .uuid("Categoría inválida")
    .nullish()
    .or(z.literal("")),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().or(z.literal("")),
  dueDay: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v, ctx) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      if (!s) return null;
      const n = Number(s);
      if (!/^\d+$/.test(s) || !Number.isInteger(n) || n < 1 || n > 31) {
        ctx.addIssue({
          code: "custom",
          message: "El día de vencimiento tiene que ser entre 1 y 31",
        });
        return z.NEVER;
      }
      return n;
    }),
});
export type FixedBillFormInput = z.input<typeof fixedBillInput>;

export const categoryInput = z.object({
  name: z.string().min(1, "Nombre requerido").max(60),
  kind: z.enum(["expense", "income"]).default("expense"),
});

export const subcategoryInput = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1, "Nombre requerido").max(60),
});
