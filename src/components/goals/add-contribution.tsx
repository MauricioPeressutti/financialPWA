"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AmountInput } from "@/components/ui/amount-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addContribution } from "@/lib/actions/goals";
import { currencyMeta, type Currency } from "@/lib/currencies";

export function AddContribution({
  goalId,
  currency,
}: {
  goalId: string;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [pending, startTransition] = useTransition();
  const sym = currencyMeta[currency as Currency]?.symbol ?? "$";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button className="w-full" onClick={() => setOpen(true)}>
        ＋ Agregar aporte
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo aporte</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Monto ({currency})</Label>
            <div className="flex items-center gap-1.5 rounded-md border bg-[var(--field-surface)] px-3">
              <span className="text-sm text-muted-foreground">{sym}</span>
              <AmountInput
                autoFocus
                value={amount}
                placeholder="0"
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cdate">Fecha</Label>
            <Input
              id="cdate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cnote">Nota (opcional)</Label>
            <Input
              id="cnote"
              value={note}
              placeholder="Ej: del sueldo, venta usada"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancelar</Button>} />
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await addContribution({
                  goalId,
                  amount,
                  note,
                  contributedOn: date,
                });
                if (!r.ok) {
                  toast.error(r.error);
                  return;
                }
                setOpen(false);
                setAmount("");
                setNote("");
                toast.success("Aporte agregado");
                router.refresh();
              })
            }
          >
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
