// Funciones puras (sin DB) — se pueden usar en cliente y servidor.

export type SplitMode = "proportional" | "even" | "custom";

export type SplitMember = { userId: string; incomeCents: number };

/**
 * Reparte `amountCents` entre `members` según el modo.
 * La suma de owedCents siempre da exactamente amountCents (los centavos
 * sobrantes van al de mayor peso).
 */
export function splitShares(
  amountCents: number,
  mode: SplitMode,
  members: SplitMember[],
  customPct?: Record<string, number>,
): { userId: string; owedCents: number }[] {
  const n = members.length;
  if (n === 0) return [];
  if (amountCents <= 0) return members.map((m) => ({ userId: m.userId, owedCents: 0 }));

  let weights: number[];
  if (mode === "even") {
    weights = members.map(() => 1);
  } else if (mode === "custom" && customPct) {
    weights = members.map((m) => Math.max(0, customPct[m.userId] ?? 0));
    if (weights.every((w) => w === 0)) weights = members.map(() => 1);
  } else {
    weights = members.map((m) => Math.max(0, m.incomeCents));
    if (weights.every((w) => w === 0)) weights = members.map(() => 1);
  }

  const wSum = weights.reduce((a, b) => a + b, 0) || 1;
  const floored = members.map((_, i) =>
    Math.floor((amountCents * weights[i]) / wSum),
  );
  let remainder = amountCents - floored.reduce((a, b) => a + b, 0);
  const order = members
    .map((_, i) => i)
    .sort((a, b) => weights[b] - weights[a]);
  const result = floored.slice();
  for (let k = 0; k < order.length && remainder > 0; k++, remainder--) {
    result[order[k]] += 1;
  }
  return members.map((m, i) => ({ userId: m.userId, owedCents: result[i] }));
}

/** % de esfuerzo de cada persona según sus ingresos declarados. */
export function effortPercents(
  members: SplitMember[],
): Record<string, number> {
  const sum = members.reduce((a, m) => a + Math.max(0, m.incomeCents), 0);
  const out: Record<string, number> = {};
  for (const m of members) {
    out[m.userId] =
      sum > 0
        ? (Math.max(0, m.incomeCents) / sum) * 100
        : members.length
          ? 100 / members.length
          : 0;
  }
  return out;
}
