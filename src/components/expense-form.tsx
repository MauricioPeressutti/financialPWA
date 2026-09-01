"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyField } from "@/components/money-field";
import { SplitFields, type SplitMember } from "@/components/split-fields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createExpense, updateExpense } from "@/lib/actions/expenses";
import {
  PAYMENT_METHODS,
  paymentMethodMeta,
  type PaymentMethod,
} from "@/lib/payment-methods";
import { expenseInput, type ExpenseInput } from "@/lib/validation";

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
  members: SplitMember[];
  effortEnabled: boolean;
  expense?: {
    id: string;
    amount: string;
    currency: string;
    fxRate: number;
    spentOn: string;
    categoryId: string;
    subcategoryId: string | null;
    paymentMethod: PaymentMethod;
    description: string | null;
    splitMode: string;
    paidByUserId: string | null;
  };
};

export function ExpenseForm({
  categories,
  primaryCurrency,
  currencies,
  usdArsRate,
  fxReferenceLabel,
  members,
  effortEnabled,
  expense,
}: Props) {
  const router = useRouter();

  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseInput),
    defaultValues: {
      amount: expense?.amount ?? "",
      currency: (expense?.currency ?? primaryCurrency) as ExpenseInput["currency"],
      fxRate:
        expense && expense.currency !== primaryCurrency
          ? String(expense.fxRate)
          : "",
      spentOn: expense?.spentOn ?? new Date().toISOString().slice(0, 10),
      categoryId: expense?.categoryId ?? "",
      subcategoryId: expense?.subcategoryId ?? "",
      paymentMethod: expense?.paymentMethod ?? "efectivo",
      description: expense?.description ?? "",
      reimbursedAmount: "",
      splitMode:
        (expense?.splitMode as ExpenseInput["splitMode"]) ?? "none",
      paidByUserId: expense?.paidByUserId ?? "",
      splitCustom: "",
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
  const paymentItems = Object.fromEntries(
    PAYMENT_METHODS.map((m) => [m, paymentMethodMeta[m].label]),
  );

  async function onSubmit(values: ExpenseInput) {
    const res = expense
      ? await updateExpense(expense.id, values)
      : await createExpense(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(expense ? "Gasto actualizado" : "Gasto cargado");
    router.push(expense ? `/expenses/${expense.id}` : "/expenses");
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
        <Label htmlFor="spentOn">Fecha</Label>
        <Input id="spentOn" type="date" {...form.register("spentOn")} />
        <FieldError msg={form.formState.errors.spentOn?.message} />
      </div>

      <div className="space-y-1.5">
        <Label>Categoría</Label>
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
                <SelectValue placeholder="Elegí una categoría" />
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
        <Label>Forma de pago</Label>
        <Controller
          control={form.control}
          name="paymentMethod"
          render={({ field }) => (
            <Select
              items={paymentItems}
              value={field.value}
              onValueChange={field.onChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => {
                  const { label, Icon } = paymentMethodMeta[m];
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

      {effortEnabled && (
        <SplitFields
          form={form}
          members={members}
          currency={form.watch("currency") || primaryCurrency}
        />
      )}

      {!expense && (
        <div className="space-y-1.5 rounded-lg border border-dashed p-3">
          <Label htmlFor="reimbursedAmount">
            ¿Te reintegraron algo? (opcional)
          </Label>
          <AmountInput
            id="reimbursedAmount"
            placeholder="0,00"
            {...form.register("reimbursedAmount")}
          />
          <p className="text-xs text-muted-foreground">
            Se anota como reintegro de este gasto, con la misma fecha.
          </p>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Guardando…" : expense ? "Guardar cambios" : "Cargar gasto"}
      </Button>
    </form>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}
