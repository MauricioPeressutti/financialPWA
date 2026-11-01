// STUB creado por el test-writer (TDD, fase RED). Solo define el contrato
// (tipos y firmas) que esperan los tests en src/lib/fixed-bills.test.ts.
// El builder tiene que reemplazar cada `throw` por la implementación real.
// Ver .factory/gastos-fijos/test-plan.md.

export type BillStatus = "pagado" | "pendiente" | "vencido";

/** Lo mínimo de un fijo que necesita la lógica pura (compatible con la fila de `fixed_bills`). */
export type FixedBillLike = {
  id: string;
  name: string;
  amountCents: number; // estimado
  currency: string;
  categoryId: string | null;
  dueDay: number | null; // 1..31
  active: boolean;
  createdAt: Date | string;
};

/** Lo mínimo de un pago (compatible con la fila de `fixed_bill_payments`). */
export type FixedBillPaymentLike = {
  billId: string;
  period: string; // "YYYY-MM-01"
  amountCents: number; // real
  currency: string;
  paidOn: string; // "YYYY-MM-DD"
  expenseId: string | null;
  createdExpense: boolean;
};

export type CandidateExpense = {
  id: string;
  amountCents: number;
  currency: string;
  categoryId: string;
  description: string | null;
  entity: string | null;
  spentOn: string; // "YYYY-MM-DD"
};

export type MonthItem = {
  bill: FixedBillLike;
  payment: FixedBillPaymentLike | null;
};

export type MonthSummary = {
  paidCount: number;
  total: number;
  byCurrency: Record<string, { paidCents: number; pendingCents: number }>;
};

export type RankedCandidate = {
  expense: CandidateExpense;
  score: number;
  suggested: boolean;
};

function notImplemented(name: string): never {
  throw new Error(`fixed-bills: ${name} no implementado (stub TDD)`);
}

/** "YYYY-MM" -> "YYYY-MM-01". Inválido/undefined -> primer día del mes actual (hora AR). */
export function parsePeriod(input?: string | null): string {
  void input;
  return notImplemented("parsePeriod");
}

/** "YYYY-MM-DD" de hoy en America/Argentina/Buenos_Aires. */
export function todayAR(now: Date = new Date()): string {
  void now;
  return notImplemented("todayAR");
}

/** "2026-02-01" -> "2026-02-28" */
export function periodLastDay(period: string): string {
  void period;
  return notImplemented("periodLastDay");
}

/** Fecha de vencimiento del período: min(dueDay, último día). null si no hay dueDay. */
export function dueDateFor(period: string, dueDay: number | null): string | null {
  void period;
  void dueDay;
  return notImplemented("dueDateFor");
}

/** "2026-11-01", +1 -> "2026-12-01"; -1 -> "2026-10-01" */
export function shiftPeriod(period: string, delta: number): string {
  void period;
  void delta;
  return notImplemented("shiftPeriod");
}

/** Último período navegable: el mes siguiente al de `today`. */
export function maxSelectablePeriod(today: string): string {
  void today;
  return notImplemented("maxSelectablePeriod");
}

export function billAppliesTo(
  bill: FixedBillLike,
  period: string,
  payment?: FixedBillPaymentLike | null,
): boolean {
  void bill;
  void period;
  void payment;
  return notImplemented("billAppliesTo");
}

export function billStatus(
  bill: FixedBillLike,
  payment: FixedBillPaymentLike | null,
  period: string,
  today: string,
): BillStatus {
  void bill;
  void payment;
  void period;
  void today;
  return notImplemented("billStatus");
}

export function monthSummary(items: MonthItem[]): MonthSummary {
  void items;
  return notImplemented("monthSummary");
}

/** Orden de la lista: vencidos, pendientes por dueDay (sin dueDay al final), pagados. */
export function sortMonthItems<T extends MonthItem>(
  items: T[],
  period: string,
  today: string,
): T[] {
  void items;
  void period;
  void today;
  return notImplemented("sortMonthItems");
}

/** Fecha por defecto del diálogo "Ya lo pagué". */
export function defaultPaidOn(
  bill: FixedBillLike,
  period: string,
  today: string,
): string {
  void bill;
  void period;
  void today;
  return notImplemented("defaultPaidOn");
}

export function scoreCandidate(bill: FixedBillLike, expense: CandidateExpense): number {
  void bill;
  void expense;
  return notImplemented("scoreCandidate");
}

/** Ventana de candidatas: [primer día − 5, último día + 5]. */
export function candidateWindow(period: string): { from: string; to: string } {
  void period;
  return notImplemented("candidateWindow");
}

export function rankLinkCandidates(
  bill: FixedBillLike,
  period: string,
  expenses: (CandidateExpense & { linked?: boolean })[],
): RankedCandidate[] {
  void bill;
  void period;
  void expenses;
  return notImplemented("rankLinkCandidates");
}
