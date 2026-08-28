"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyField } from "@/components/money-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createIncome, updateIncome } from "@/lib/actions/incomes";
import {
  INCOME_METHODS,
  incomeMethodMeta,
  type IncomeMethod,
} from "@/lib/income-methods";
import { incomeInput, type IncomeInput } from "@/lib/validation";

type Category = {
  id: string;
  name: string;
  subcategories: { id: string; name: string }[];
};

type Props = {
  categories: Category[];
  primaryCurrency: string;
  currencies: string[];
  usdArsRate: number | null;
  fxReferenceLabel: string;
  income?: {
    id: string;
    amount: string;
    currency: string;
    fxRate: number;
    receivedOn: string;
    categoryId: string;
    subcategoryId: string | null;
    method: IncomeMethod;
    description: string | null;
  };
};

export function IncomeForm({
  categories,
  primaryCurrency,
  currencies,
  usdArsRate,
  fxReferenceLabel,
  income,
}: Props) {
  const router = useRouter();

  const form = useForm<IncomeInput>({
    resolver: zodResolver(incomeInput),
    defaultValues: {
      amount: income?.amount ?? "",
      currency: (income?.currency ?? primaryCurrency) as IncomeInput["currency"],
      fxRate:
        income && income.currency !== primaryCurrency
          ? String(income.fxRate)
          : "",
      receivedOn: income?.receivedOn ?? new Date().toISOString().slice(0, 10),
      categoryId: income?.categoryId ?? "",
      subcategoryId: income?.subcategoryId ?? "",
      method: income?.method ?? "transferencia",
      description: income?.description ?? "",
    },
  });

  const categoryId = form.watch("categoryId");
  const subs = useMemo(
    () => categories.find((c) => c.id === categoryId)?.subcategories ?? [],
    [categories, categoryId],
  );

  const categoryItems = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );
  const subItems = useMemo(
    () => Object.fromEntries(subs.map((s) => [s.id, s.name])),
    [subs],
  );
  const methodItems = Object.fromEntries(
    INCOME_METHODS.map((m) => [m, incomeMethodMeta[m].label]),
  );

  async function onSubmit(values: IncomeInput) {
    const res = income
      ? await updateIncome(income.id, values)
      : await createIncome(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(income ? "Ingreso actualizado" : "Ingreso cargado");
    router.push(income ? `/incomes/${income.id}` : "/movimientos/ingresos");
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <MoneyField
        form={form}
        primaryCurrency={primaryCurrency}
        currencies={currencies}
        usdArsRate={usdArsRate}
        fxReferenceLabel={fxReferenceLabel}
      />

      <div className="space-y-1.5">
        <Label htmlFor="receivedOn">Fecha</Label>
        <Input id="receivedOn" type="date" {...form.register("receivedOn")} />
        <FieldError msg={form.formState.errors.receivedOn?.message} />
      </div>

      <div className="space-y-1.5">
        <Label>Fuente</Label>
        <Controller
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <Select
              items={categoryItems}
              value={field.value}
              onValueChange={(v) => {
                field.onChange(v);
                form.setValue("subcategoryId", "");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí una fuente" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError msg={form.formState.errors.categoryId?.message} />
      </div>

      {subs.length > 0 && (
        <div className="space-y-1.5">
          <Label>Subcategoría (opcional)</Label>
          <Controller
            control={form.control}
            name="subcategoryId"
            render={({ field }) => (
              <Select
                items={subItems}
                value={field.value || ""}
                onValueChange={field.onChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin subcategoría" />
                </SelectTrigger>
                <SelectContent>
                  {subs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Medio</Label>
        <Controller
          control={form.control}
          name="method"
          render={({ field }) => (
            <Select
              items={methodItems}
              value={field.value}
              onValueChange={field.onChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCOME_METHODS.map((m) => {
                  const { label, Icon } = incomeMethodMeta[m];
                  return (
                    <SelectItem key={m} value={m}>
                      <Icon className="size-4 text-muted-foreground" />
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Descripción (opcional)</Label>
        <Textarea id="description" rows={2} {...form.register("description")} />
      </div>

      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting
          ? "Guardando…"
          : income
            ? "Guardar cambios"
            : "Cargar ingreso"}
      </Button>
    </form>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}
