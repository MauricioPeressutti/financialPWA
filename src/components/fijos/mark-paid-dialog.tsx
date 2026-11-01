"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markFixedBillPaid } from "@/lib/actions/fixed-bills";
import { currencyMeta, type Currency } from "@/lib/currencies";
import { centsToAmountInput } from "@/lib/money";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: {
    id: string;
    name: string;
    emoji: string;
    amountCents: number;
    currency: string;
    categoryId: string | null;
  };
  period: string;
  defaultDate: string;
};

export function MarkPaidDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && <Body {...props} />}
    </Dialog>
  );
}

function Body({ onOpenChange, bill, period, defaultDate }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(centsToAmountInput(bill.amountCents));
  const [paidOn, setPaidOn] = useState(defaultDate);
  const canCreate = Boolean(bill.categoryId);
  const [createExpense, setCreateExpense] = useState(canCreate);
  const sym = currencyMeta[bill.currency as Currency]?.symbol ?? "$";

  function confirm() {
    startTransition(async () => {
      const r = await markFixedBillPaid({
        billId: bill.id,
        period,
        amount,
        paidOn,
        createExpense: canCreate && createExpense,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(createExpense && canCreate ? "Pagado y registrado como gasto" : "Marcado como pagado");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {bill.emoji} {bill.name}: ya lo pagué
        </DialogTitle>
        <DialogDescription>Si ya lo cargaste (Telegram, resumen), usá Vincular.</DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="mp-amount">Monto ({bill.currency})</Label>
          <div className="flex h-10 items-center gap-1.5 rounded-lg border bg-[var(--field-surface)] px-3">
            <span className="text-sm text-muted-foreground">{sym}</span>
            <AmountInput
              id="mp-amount"
              autoFocus
              value={amount}
              placeholder="0"
              className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mp-date">Fecha de pago</Label>
          <Input
            id="mp-date"
            type="date"
            className="h-10"
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
          />
        </div>

        <label
          className={`flex items-start gap-2.5 rounded-lg border p-3 ${canCreate ? "" : "opacity-60"}`}
        >
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-primary"
            checked={canCreate && createExpense}
            disabled={!canCreate}
            onChange={(e) => setCreateExpense(e.target.checked)}
          />
          <span className="min-w-0">
            <span className="block font-medium">Registrarlo también como gasto</span>
            <span className="block text-xs text-muted-foreground">
              {canCreate
                ? "Si no lo registrás, no suma en Análisis ni en el balance."
                : "Elegí una categoría en el fijo para registrarlo como gasto"}
            </span>
          </span>
        </label>
      </div>

      <DialogFooter>
        <DialogClose
          render={
            <Button variant="outline" className="h-10" disabled={pending}>
              Cancelar
            </Button>
          }
        />
        <Button className="h-10" disabled={pending} onClick={confirm}>
          {pending ? "Guardando…" : "Confirmar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
