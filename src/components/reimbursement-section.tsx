"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addReimbursement, deleteReimbursement } from "@/lib/actions/expenses";
import { formatCents } from "@/lib/money";

type Reimbursement = {
  id: string;
  amountCents: number;
  note: string | null;
  reimbursedOn: string;
};

export function ReimbursementSection({
  expenseId,
  reimbursements,
}: {
  expenseId: string;
  reimbursements: Reimbursement[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  function add() {
    startTransition(async () => {
      const res = await addReimbursement({
        expenseId,
        amount,
        reimbursedOn: date,
        note,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAmount("");
      setNote("");
      toast.success("Reintegro agregado");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteReimbursement(id);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">Reintegros</h2>

      {reimbursements.length > 0 && (
        <div className="divide-y">
          {reimbursements.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium">{formatCents(r.amountCents)}</p>
                <p className="text-xs text-muted-foreground">
                  {r.reimbursedOn}
                  {r.note ? ` · ${r.note}` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(r.id)}
                disabled={pending}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 rounded-lg border p-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Monto</Label>
            <Input
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fecha</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nota (opcional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button size="sm" onClick={add} disabled={pending || !amount}>
          Agregar reintegro
        </Button>
      </div>
    </section>
  );
}
