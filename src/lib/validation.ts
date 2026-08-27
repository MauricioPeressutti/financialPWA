import { z } from "zod";

export const expenseInput = z.object({
  amount: z.string().min(1, "Ingresá un monto"),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  categoryId: z.string().uuid("Elegí una categoría"),
  subcategoryId: z.string().uuid().optional().or(z.literal("")),
  paymentMethod: z.enum(["efectivo", "debito", "credito"]),
  description: z.string().max(280).optional().or(z.literal("")),
  // Reintegro inmediato opcional (ej: MODO devuelve al toque). Se anota
  // como reintegro del mismo gasto, con la fecha del gasto.
  reimbursedAmount: z.string().optional().or(z.literal("")),
});
export type ExpenseInput = z.infer<typeof expenseInput>;

export const reimbursementInput = z.object({
  expenseId: z.string().uuid(),
  amount: z.string().min(1, "Ingresá un monto"),
  reimbursedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  note: z.string().max(280).optional().or(z.literal("")),
});

export const categoryInput = z.object({
  name: z.string().min(1, "Nombre requerido").max(60),
});

export const subcategoryInput = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1, "Nombre requerido").max(60),
});
