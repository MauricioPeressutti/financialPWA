"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { formatAmountInput } from "@/lib/money";

/**
 * Input de monto: formatea al vuelo con separador de miles es-AR
 * ("1000000" -> "1.000.000", "2500,5" -> "2.500,5").
 * Sirve controlado (value/onChange) y con react-hook-form
 * (spread de `form.register("...")`). El valor que sale del onChange
 * ya viene formateado — `parseAmountToCents` lo entiende.
 */
export function AmountInput({
  onChange,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      inputMode="decimal"
      autoComplete="off"
      {...props}
      onChange={(e) => {
        const el = e.currentTarget;
        const formatted = formatAmountInput(el.value);
        if (formatted !== el.value) el.value = formatted;
        onChange?.(e);
      }}
    />
  );
}
