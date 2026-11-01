import "server-only";

// STUB creado por el test-writer (TDD, fase RED). Solo define el contrato que
// esperan los tests en src/lib/fixed-bills-queries.test.ts. El builder tiene
// que reemplazarlo. Ver .factory/gastos-fijos/test-plan.md.

import type {
  FixedBillLike,
  FixedBillPaymentLike,
  RankedCandidate,
} from "@/lib/fixed-bills";

export type FixedBillMonthRow = {
  bill: FixedBillLike & {
    teamId: string;
    userId: string;
    emoji: string;
    paymentMethod: string;
  };
  payment: (FixedBillPaymentLike & { id: string }) | null;
};

/** Fijos de (teamId, userId) que aplican al período, con su pago del período (o null). */
export async function listFixedBillsForMonth(
  teamId: string,
  userId: string,
  period: string,
): Promise<FixedBillMonthRow[]> {
  void teamId;
  void userId;
  void period;
  throw new Error("listFixedBillsForMonth no implementado (stub TDD)");
}

/**
 * Gastos candidatos para vincular al fijo `billId` (que debe ser de teamId+userId;
 * si no, devuelve []). Solo gastos de teamId, dentro de candidateWindow(period)
 * y sin vínculo previo, ordenados con rankLinkCandidates.
 */
export async function listLinkCandidates(
  teamId: string,
  userId: string,
  billId: string,
  period: string,
): Promise<RankedCandidate[]> {
  void teamId;
  void userId;
  void billId;
  void period;
  throw new Error("listLinkCandidates no implementado (stub TDD)");
}
