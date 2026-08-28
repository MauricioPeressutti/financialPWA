"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { currencyMeta, type Currency } from "@/lib/currencies";
import { formatCents, parseAmountToCents } from "@/lib/money";

type Props = {
  form: any; // useForm return (ExpenseInput | IncomeInput)
  label?: string;
  primaryCurrency: string;
  currencies: string[];
  /** 1 USD = ? ARS (cotización de hoy, para el preview) */
  usdArsRate: number | null;
  fxReferenceLabel: string;
};

export function MoneyField({
  form,
  label = "Monto",
  primaryCurrency,
  currencies,
  usdArsRate,
  fxReferenceLabel,
}: Props) {
  const currency: string = form.watch("currency") || primaryCurrency;
  const amount: string = form.watch("amount") || "";
  const fxRate: string = form.watch("fxRate") || "";
  const foreign = currency !== primaryCurrency;

  // sugerir un TC por defecto cuando se elige una moneda extranjera sin valor
  const suggested =
    currency === "USD" && primaryCurrency === "ARS" && usdArsRate
      ? usdArsRate
      : currency === "ARS" && primaryCurrency === "USD" && usdArsRate
        ? 1 / usdArsRate
        : null;

  useEffect(() => {
    if (foreign && !fxRate && suggested) {
      form.setValue("fxRate", String(Math.round(suggested * 100) / 100));
    }
    if (!foreign && fxRate) form.setValue("fxRate", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foreign, suggested]);

  const rateNum = Number(String(fxRate).replace(/\./g, "").replace(",", "."));
  const cents = parseAmountToCents(amount);
  const equivCents =
    foreign && cents && rateNum > 0 ? Math.round(cents * rateNum) : null;

  const sym = currencyMeta[currency as Currency]?.symbol ?? "$";

  return (
    <div className="space-y-1.5">
      <Label htmlFor="amount">{label}</Label>
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-1.5 rounded-md border bg-[var(--field-surface)] px-3">
          <span className="text-sm text-muted-foreground">{sym}</span>
          <Input
            id="amount"
            inputMode="decimal"
            placeholder="0,00"
            autoFocus
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            {...form.register("amount")}
          />
        </div>
        <select
          className="rounded-md border bg-[var(--field-surface)] px-2.5 text-sm font-semibold"
          value={currency}
          onChange={(e) => form.setValue("currency", e.target.value)}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {currencyMeta[c as Currency]?.symbol ?? c} {c}
            </option>
          ))}
        </select>
      </div>
      <FieldError msg={form.formState.errors.amount?.message} />

      {foreign && (
        <div className="mt-1 space-y-2 rounded-lg border border-dashed p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Tipo de cambio ({fxReferenceLabel})
            </span>
            <span className="flex items-center gap-1.5">
              1 {currency} ={" "}
              {currencyMeta[primaryCurrency as Currency]?.symbol ?? "$"}
              <Input
                inputMode="decimal"
                className="h-7 w-24 text-right tabular-nums"
                {...form.register("fxRate")}
              />
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Equivale a</span>
            <span className="font-semibold tabular-nums">
              {equivCents !== null ? formatCents(equivCents) : "—"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Solo como referencia (no afecta los totales). De dolarapi.com — editalo
            si compraste a otro valor.
          </p>
        </div>
      )}
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}
