"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createExpense, updateExpense } from "@/lib/actions/expenses";
import { expenseInput, type ExpenseInput } from "@/lib/validation";

type Category = {
  id: string;
  name: string;
  subcategories: { id: string; name: string }[];
};

type Props = {
  categories: Category[];
  expense?: {
    id: string;
    amount: string;
    spentOn: string;
    categoryId: string;
    subcategoryId: string | null;
    paymentMethod: "efectivo" | "debito" | "credito";
    description: string | null;
  };
};

export function ExpenseForm({ categories, expense }: Props) {
  const router = useRouter();

  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseInput),
    defaultValues: {
      amount: expense?.amount ?? "",
      spentOn: expense?.spentOn ?? new Date().toISOString().slice(0, 10),
      categoryId: expense?.categoryId ?? "",
      subcategoryId: expense?.subcategoryId ?? "",
      paymentMethod: expense?.paymentMethod ?? "efectivo",
      description: expense?.description ?? "",
    },
  });

  const categoryId = form.watch("categoryId");
  const subs = useMemo(
    () => categories.find((c) => c.id === categoryId)?.subcategories ?? [],
    [categories, categoryId],
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
      <div className="space-y-1.5">
        <Label htmlFor="amount">Monto</Label>
        <Input
          id="amount"
          inputMode="decimal"
          placeholder="0,00"
          autoFocus
          {...form.register("amount")}
        />
        <FieldError msg={form.formState.errors.amount?.message} />
      </div>

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
              <Select value={field.value || ""} onValueChange={field.onChange}>
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
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="debito">Débito</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
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
        {form.formState.isSubmitting ? "Guardando…" : expense ? "Guardar cambios" : "Cargar gasto"}
      </Button>
    </form>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}
