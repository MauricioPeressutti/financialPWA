"use server";

// STUB creado por el test-writer (TDD, fase RED). Solo define el contrato que
// esperan los tests en src/lib/actions/fixed-bills.test.ts. El builder tiene
// que reemplazarlo por la implementación real (requireTeam + filtros
// team_id/user_id). Ver .factory/gastos-fijos/test-plan.md.

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export type FixedBillInput = {
  name: string;
  emoji?: string;
  amount: string; // "15.000" / "15000,50"
  currency?: string; // default: team.primaryCurrency
  categoryId?: string | null; // "" o null = sin categoría
  paymentMethod?: string; // default "debito"
  dueDay?: string | number | null; // "" o null = sin vencimiento
};

function notImplemented(name: string): never {
  throw new Error(`actions/fixed-bills: ${name} no implementado (stub TDD)`);
}

export async function createFixedBill(
  input: FixedBillInput,
): Promise<ActionResult<{ id: string }>> {
  void input;
  return notImplemented("createFixedBill");
}

export async function updateFixedBill(
  id: string,
  input: FixedBillInput,
): Promise<ActionResult> {
  void id;
  void input;
  return notImplemented("updateFixedBill");
}

export async function setFixedBillActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  void id;
  void active;
  return notImplemented("setFixedBillActive");
}

export async function deleteFixedBill(id: string): Promise<ActionResult> {
  void id;
  return notImplemented("deleteFixedBill");
}

export async function markFixedBillPaid(input: {
  billId: string;
  period: string; // "YYYY-MM-01" o "YYYY-MM"
  amount: string;
  paidOn: string; // "YYYY-MM-DD"
  createExpense: boolean;
}): Promise<ActionResult> {
  void input;
  return notImplemented("markFixedBillPaid");
}

export async function linkFixedBillExpense(input: {
  billId: string;
  period: string;
  expenseId: string;
}): Promise<ActionResult> {
  void input;
  return notImplemented("linkFixedBillExpense");
}

export async function unmarkFixedBillPaid(input: {
  billId: string;
  period: string;
}): Promise<ActionResult> {
  void input;
  return notImplemented("unmarkFixedBillPaid");
}
