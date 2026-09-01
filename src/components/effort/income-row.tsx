"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { setMyDeclaredIncome } from "@/lib/actions/effort";
import { currencyMeta, type Currency } from "@/lib/currencies";
import { formatAmountInput } from "@/lib/money";

export function IncomeRow({
  name,
  incomeCents,
  currency,
  editable,
  color,
}: {
  name: string;
  incomeCents: number;
  currency: string;
  editable: boolean;
  color: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(
    incomeCents ? formatAmountInput(String(Math.round(incomeCents / 100))) : "",
  );
  const sym = currencyMeta[currency as Currency]?.symbol ?? "$";

  function save() {
    startTransition(async () => {
      const r = await setMyDeclaredIncome({ amount: value, currency });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Ingreso actualizado");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
        style={{ background: color }}
      >
        {name[0]?.toUpperCase()}
      </span>
      <span className="flex-1 text-sm font-medium">{name}</span>
      {editable ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border bg-[var(--field-surface)] px-2.5">
            <span className="text-xs text-muted-foreground">{sym}</span>
            <AmountInput
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-8 w-24 border-0 bg-transparent px-0 text-right shadow-none focus-visible:ring-0"
            />
          </div>
          <Button size="xs" variant="outline" disabled={pending} onClick={save}>
            OK
          </Button>
        </div>
      ) : (
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
          {incomeCents
            ? `${sym} ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(incomeCents / 100)}`
            : "sin cargar"}
        </span>
      )}
    </div>
  );
}
