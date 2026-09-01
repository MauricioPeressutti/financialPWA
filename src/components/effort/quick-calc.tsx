"use client";

import { useState } from "react";

import { AmountInput } from "@/components/ui/amount-input";
import { effortPercents, splitShares } from "@/lib/effort";
import { formatAmountInput, formatMoney, parseAmountToCents } from "@/lib/money";
import { currencyMeta, type Currency } from "@/lib/currencies";

type M = { userId: string; name: string; incomeCents: number };

export function QuickCalc({
  members,
  currency,
  colors,
}: {
  members: M[];
  currency: string;
  colors: Record<string, string>;
}) {
  const [amount, setAmount] = useState(formatAmountInput("120000"));
  const cents = parseAmountToCents(amount) ?? 0;
  const sym = currencyMeta[currency as Currency]?.symbol ?? "$";

  const shares = splitShares(cents, "proportional", members);
  const pcts = effortPercents(members);
  const half = cents / 2;
  const top = shares.reduce((a, b) => (b.owedCents > a.owedCents ? b : a), shares[0]);
  const diff = top ? Math.abs(top.owedCents - half) : 0;
  const nameOf = (id: string) => members.find((m) => m.userId === id)?.name ?? "";

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-xl border bg-[var(--field-surface)] px-3.5 py-3">
        <span className="font-semibold text-muted-foreground">{sym}</span>
        <AmountInput
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-auto w-full border-0 bg-transparent p-0 text-lg tabular-nums shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="divide-y">
        {shares.map((s) => {
          const pct = pcts[s.userId] ?? 0;
          return (
            <div key={s.userId} className="flex items-center gap-3 py-2.5">
              <span
                className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                style={{ background: colors[s.userId] }}
              >
                {nameOf(s.userId)[0]?.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{nameOf(s.userId)}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {pct.toFixed(0)}% del ingreso conjunto
                </div>
                <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: colors[s.userId] }}
                  />
                </div>
              </div>
              <span className="text-base font-bold tabular-nums">
                {formatMoney(s.owedCents, currency)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {diff < 100 ? (
          <>Con estos ingresos, el reparto da <b>casi por mitades</b>.</>
        ) : (
          <>
            Por mitades sería <b>{formatMoney(half, currency)}</b> cada uno.{" "}
            {top && (
              <>
                Con el reparto por ingreso, <b>{nameOf(top.userId)}</b> pone{" "}
                <b>{formatMoney(diff, currency)} más</b>.
              </>
            )}
          </>
        )}
      </p>
    </div>
  );
}
