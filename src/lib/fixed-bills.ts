// Lógica pura de gastos fijos (sin DB). Las fechas viajan como strings
// "YYYY-MM-DD" y el "hoy"/"mes actual" se calcula en hora de Argentina.

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

const TZ = "America/Argentina/Buenos_Aires";
const DAY_MS = 86_400_000;

const arDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toUtcMs(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  return fromUtcMs(toUtcMs(isoDate) + days * DAY_MS);
}

function periodOf(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

/**
 * "YYYY-MM" o "YYYY-MM-DD" -> "YYYY-MM-01". null si no es un mes válido.
 * Útil en las actions, donde un período inválido es un error.
 */
export function normalizePeriod(input?: string | null): string | null {
  if (!input) return null;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(input.trim());
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}-01`;
}

/** "YYYY-MM" -> "YYYY-MM-01". Inválido/undefined -> primer día del mes actual (hora AR). */
export function parsePeriod(input?: string | null): string {
  return normalizePeriod(input) ?? periodOf(todayAR());
}

/** "YYYY-MM-DD" de hoy en America/Argentina/Buenos_Aires. */
export function todayAR(now: Date = new Date()): string {
  return arDateFmt.format(now);
}

/** "2026-02-01" -> "2026-02-28" */
export function periodLastDay(period: string): string {
  const y = Number(period.slice(0, 4));
  const m = Number(period.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${period.slice(0, 7)}-${pad(last)}`;
}

/** Fecha de vencimiento del período: min(dueDay, último día). null si no hay dueDay. */
export function dueDateFor(period: string, dueDay: number | null): string | null {
  if (dueDay == null) return null;
  const last = Number(periodLastDay(period).slice(8, 10));
  return `${period.slice(0, 7)}-${pad(Math.min(dueDay, last))}`;
}

/** "2026-11-01", +1 -> "2026-12-01"; -1 -> "2026-10-01" */
export function shiftPeriod(period: string, delta: number): string {
  const y = Number(period.slice(0, 4));
  const m = Number(period.slice(5, 7));
  return fromUtcMs(Date.UTC(y, m - 1 + delta, 1));
}

/** Último período navegable: el mes siguiente al de `today`. */
export function maxSelectablePeriod(today: string): string {
  return shiftPeriod(periodOf(today), 1);
}

/** Mes (día 1) de creación del fijo, en hora de Argentina. */
function creationPeriod(bill: FixedBillLike): string {
  return periodOf(todayAR(new Date(bill.createdAt)));
}

export function billAppliesTo(
  bill: FixedBillLike,
  period: string,
  payment?: FixedBillPaymentLike | null,
): boolean {
  if (payment) return true;
  return bill.active && period >= creationPeriod(bill);
}

export function billStatus(
  bill: FixedBillLike,
  payment: FixedBillPaymentLike | null,
  period: string,
  today: string,
): BillStatus {
  if (payment) return "pagado";
  const due = dueDateFor(period, bill.dueDay);
  return due && today > due ? "vencido" : "pendiente";
}

export function monthSummary(items: MonthItem[]): MonthSummary {
  const byCurrency: MonthSummary["byCurrency"] = {};
  const slot = (cur: string) =>
    (byCurrency[cur] ??= { paidCents: 0, pendingCents: 0 });
  let paidCount = 0;
  for (const { bill, payment } of items) {
    if (payment) {
      paidCount++;
      slot(payment.currency).paidCents += payment.amountCents;
    } else {
      slot(bill.currency).pendingCents += bill.amountCents;
    }
  }
  return { paidCount, total: items.length, byCurrency };
}

const STATUS_RANK: Record<BillStatus, number> = {
  vencido: 0,
  pendiente: 1,
  pagado: 2,
};

/** Orden de la lista: vencidos, pendientes por dueDay (sin dueDay al final), pagados. */
export function sortMonthItems<T extends MonthItem>(
  items: T[],
  period: string,
  today: string,
): T[] {
  const keyed = items.map((item) => ({
    item,
    rank: STATUS_RANK[billStatus(item.bill, item.payment, period, today)],
    day: item.bill.dueDay ?? 99,
  }));
  keyed.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.day - b.day ||
      a.item.bill.name.localeCompare(b.item.bill.name, "es"),
  );
  return keyed.map((k) => k.item);
}

/** Fecha por defecto del diálogo "Ya lo pagué". */
export function defaultPaidOn(
  bill: FixedBillLike,
  period: string,
  today: string,
): string {
  if (periodOf(today) === period) return today;
  return dueDateFor(period, bill.dueDay) ?? periodLastDay(period);
}

function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function scoreCandidate(bill: FixedBillLike, expense: CandidateExpense): number {
  let score = 0;
  if (bill.categoryId && expense.categoryId === bill.categoryId) score += 40;

  const name = normalizeText(bill.name);
  if (name) {
    const inDesc = expense.description ? normalizeText(expense.description).includes(name) : false;
    const inEntity = expense.entity ? normalizeText(expense.entity).includes(name) : false;
    if (inDesc || inEntity) score += 30;
  }

  if (Math.abs(expense.amountCents - bill.amountCents) <= 0.2 * bill.amountCents) score += 20;
  if (expense.currency === bill.currency) score += 10;
  return score;
}

/** Ventana de candidatas: [primer día − 5, último día + 5]. */
export function candidateWindow(period: string): { from: string; to: string } {
  return { from: addDays(period, -5), to: addDays(periodLastDay(period), 5) };
}

export function rankLinkCandidates(
  bill: FixedBillLike,
  period: string,
  expenses: (CandidateExpense & { linked?: boolean })[],
): RankedCandidate[] {
  const { from, to } = candidateWindow(period);
  const due = dueDateFor(period, bill.dueDay);
  const distance = (spentOn: string) =>
    due ? Math.abs(toUtcMs(spentOn) - toUtcMs(due)) : 0;

  return expenses
    .filter((e) => !e.linked && e.spentOn >= from && e.spentOn <= to)
    .map((e) => {
      const { linked: _linked, ...expense } = e;
      void _linked;
      return { expense, score: scoreCandidate(bill, expense), dist: distance(e.spentOn) };
    })
    .sort((a, b) => b.score - a.score || a.dist - b.dist)
    .map((c, i) => ({
      expense: c.expense,
      score: c.score,
      suggested: i < 3 && c.score >= 50,
    }));
}
