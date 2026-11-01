"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { linkFixedBillExpense } from "@/lib/actions/fixed-bills";
import { fmtDay } from "@/lib/datetime";
import type { RankedCandidate } from "@/lib/fixed-bills";
import { formatMoney } from "@/lib/money";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: { id: string; name: string; emoji: string };
  period: string;
  candidates: RankedCandidate[];
  categoryNames: Record<string, string>;
  /** Alternativa cuando no hay candidatos: abrir "Ya lo pagué". */
  onMarkPaid: () => void;
};

export function LinkExpenseDialog({
  open,
  onOpenChange,
  bill,
  period,
  candidates,
  categoryNames,
  onMarkPaid,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function link(expenseId: string) {
    startTransition(async () => {
      const r = await linkFixedBillExpense({ billId: bill.id, period, expenseId });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Gasto vinculado");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {bill.emoji} Vincular {bill.name} a un gasto
          </DialogTitle>
          <DialogDescription>
            Elegí el gasto que ya cargaste. No se crea un gasto nuevo.
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <div className="space-y-3 py-2 text-center">
            <p className="text-muted-foreground">No hay gastos de este mes para vincular.</p>
            <Button
              className="h-10"
              onClick={() => {
                onOpenChange(false);
                onMarkPaid();
              }}
            >
              Ya lo pagué
            </Button>
          </div>
        ) : (
          <ul className="-mx-1 max-h-[55dvh] divide-y overflow-y-auto">
            {candidates.map(({ expense: e, suggested }) => (
              <li key={e.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => link(e.id)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-md px-1 py-2 text-left hover:bg-muted disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5">
                      <span className="truncate">{categoryNames[e.categoryId] ?? "Gasto"}</span>
                      {suggested && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                          Sugerido
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {fmtDay(e.spentOn)}
                      {e.description ? ` · ${e.description}` : ""}
                      {e.entity ? ` · ${e.entity}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium">
                    {formatMoney(e.amountCents, e.currency)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" className="h-10" disabled={pending}>
                Cancelar
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
