"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createFixedBill,
  deleteFixedBill,
  setFixedBillActive,
  updateFixedBill,
} from "@/lib/actions/fixed-bills";
import { currencyMeta, type Currency } from "@/lib/currencies";
import { centsToAmountInput } from "@/lib/money";
import { PAYMENT_METHODS, paymentMethodLabels } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";

const EMOJIS = ["🧾", "📱", "🌐", "🏋️", "🏠", "💡", "🔥", "💧", "📺", "🎵", "🚗", "🐶"];

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-[var(--field-surface)] px-2.5 text-sm";

export type FixedBillFormBill = {
  id: string;
  name: string;
  emoji: string;
  amountCents: number;
  currency: string;
  categoryId: string | null;
  paymentMethod: string;
  dueDay: number | null;
  active: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill?: FixedBillFormBill;
  categories: { id: string; name: string }[];
  currencies: string[];
  primaryCurrency: string;
};

/** Alta / edición de un fijo en un Dialog. En edición incluye Archivar y Eliminar. */
export function FixedBillFormDialog(props: Props) {
  // key: al abrir otro fijo (o reabrir) se reinicia el estado del formulario
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && <FormBody key={props.bill?.id ?? "new"} {...props} />}
    </Dialog>
  );
}

function FormBody({ onOpenChange, bill, categories, currencies, primaryCurrency }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState(bill?.name ?? "");
  const [emoji, setEmoji] = useState(bill?.emoji ?? "🧾");
  const [amount, setAmount] = useState(bill ? centsToAmountInput(bill.amountCents) : "");
  const [currency, setCurrency] = useState(bill?.currency ?? primaryCurrency);
  const [categoryId, setCategoryId] = useState(bill?.categoryId ?? "");
  const [paymentMethod, setPaymentMethod] = useState(bill?.paymentMethod ?? "debito");
  const [dueDay, setDueDay] = useState(bill?.dueDay ? String(bill.dueDay) : "");

  const sym = currencyMeta[currency as Currency]?.symbol ?? "$";
  // si la categoría del fijo se archivó, igual la mostramos para no perderla
  const categoryOptions =
    bill?.categoryId && !categories.some((c) => c.id === bill.categoryId)
      ? [...categories, { id: bill.categoryId, name: "(categoría archivada)" }]
      : categories;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error ?? "Algo salió mal");
        return;
      }
      toast.success(success);
      onOpenChange(false);
      router.refresh();
    });
  }

  function submit() {
    const input = { name, emoji, amount, currency, categoryId, paymentMethod, dueDay };
    if (bill) run(() => updateFixedBill(bill.id, input), "Fijo actualizado");
    else run(() => createFixedBill(input), "Fijo creado");
  }

  return (
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{bill ? "Editar fijo" : "Nuevo fijo"}</DialogTitle>
        <DialogDescription>Un gasto que se repite todos los meses.</DialogDescription>
      </DialogHeader>

      {confirmDelete && bill ? (
        <div className="space-y-3">
          <p>
            ¿Eliminar &ldquo;{bill.name}&rdquo;? Se borran el fijo y sus pagos marcados. Los
            gastos de Movimientos no se tocan.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="h-10"
              disabled={pending}
              onClick={() => setConfirmDelete(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="h-10"
              disabled={pending}
              onClick={() => run(() => deleteFixedBill(bill.id), "Fijo eliminado")}
            >
              Sí, eliminar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="fb-name">Nombre</Label>
              <Input
                id="fb-name"
                value={name}
                maxLength={60}
                placeholder="Ej: Teléfono"
                className="h-10"
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Ícono</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    aria-pressed={emoji === e}
                    aria-label={`Ícono ${e}`}
                    onClick={() => setEmoji(e)}
                    className={cn(
                      "grid size-10 place-items-center rounded-lg border text-lg",
                      emoji === e ? "border-primary bg-primary/10" : "border-border",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fb-amount">Monto estimado</Label>
              <div className="flex gap-2">
                <div className="flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-lg border bg-[var(--field-surface)] px-3">
                  <span className="text-sm text-muted-foreground">{sym}</span>
                  <AmountInput
                    id="fb-amount"
                    value={amount}
                    placeholder="0"
                    className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                {currencies.length > 1 && (
                  <select
                    aria-label="Moneda"
                    className="h-10 rounded-lg border bg-[var(--field-surface)] px-2.5 text-sm font-semibold"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {currencies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fb-category">Categoría (opcional)</Label>
              <select
                id="fb-category"
                className={selectClass}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Sin categoría</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Se usa al registrar el pago como gasto.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="fb-method">Forma de pago</Label>
                <select
                  id="fb-method"
                  className={selectClass}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {paymentMethodLabels[m]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="fb-due">Vence el día</Label>
                <Input
                  id="fb-due"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  placeholder="Opcional"
                  className="h-10"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            {bill && (
              <div className="flex gap-2 sm:mr-auto">
                <Button
                  variant="outline"
                  className="h-10 flex-1"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => setFixedBillActive(bill.id, !bill.active),
                      bill.active ? "Fijo archivado" : "Fijo reactivado",
                    )
                  }
                >
                  {bill.active ? "Archivar" : "Reactivar"}
                </Button>
                <Button
                  variant="destructive"
                  className="h-10 flex-1"
                  disabled={pending}
                  onClick={() => setConfirmDelete(true)}
                >
                  Eliminar
                </Button>
              </div>
            )}
            <Button className="h-10" disabled={pending} onClick={submit}>
              {pending ? "Guardando…" : bill ? "Guardar" : "Crear fijo"}
            </Button>
          </DialogFooter>
        </>
      )}
    </DialogContent>
  );
}

/** Botón "+ Fijo" del encabezado (y del estado vacío). */
export function NewFixedBillButton({
  categories,
  currencies,
  primaryCurrency,
  className,
}: Omit<Props, "open" | "onOpenChange" | "bill"> & { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className={cn("h-10 px-3", className)} onClick={() => setOpen(true)}>
        + Fijo
      </Button>
      <FixedBillFormDialog
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        currencies={currencies}
        primaryCurrency={primaryCurrency}
      />
    </>
  );
}
