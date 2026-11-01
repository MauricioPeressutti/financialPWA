"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FixedBillFormDialog } from "@/components/fijos/fixed-bill-form";
import { LinkExpenseDialog } from "@/components/fijos/link-expense-dialog";
import { MarkPaidDialog } from "@/components/fijos/mark-paid-dialog";
import { unmarkFixedBillPaid } from "@/lib/actions/fixed-bills";
import { fmtDay } from "@/lib/datetime";
import {
  defaultPaidOn,
  rankLinkCandidates,
  type BillStatus,
} from "@/lib/fixed-bills";
import type { FixedBillMonthRow, WindowExpense } from "@/lib/fixed-bills-queries";
import { formatMoney } from "@/lib/money";

type Props = {
  item: FixedBillMonthRow;
  status: BillStatus;
  period: string;
  today: string;
  windowExpenses: WindowExpense[];
  categoryNames: Record<string, string>;
  categories: { id: string; name: string }[];
  currencies: string[];
  primaryCurrency: string;
};

const STATUS_BADGE: Record<BillStatus, { label: string; className?: string; variant: "secondary" | "destructive" | "default" }> = {
  pagado: {
    label: "Pagado",
    variant: "default",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  pendiente: { label: "Pendiente", variant: "secondary" },
  vencido: { label: "Vencido", variant: "destructive" },
};

export function FixedBillRow({
  item,
  status,
  period,
  today,
  windowExpenses,
  categoryNames,
  categories,
  currencies,
  primaryCurrency,
}: Props) {
  const { bill, payment } = item;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const candidates = useMemo(
    () => (linkOpen ? rankLinkCandidates(bill, period, windowExpenses) : []),
    [linkOpen, bill, period, windowExpenses],
  );

  const badge = STATUS_BADGE[status];
  const categoryName = bill.categoryId ? categoryNames[bill.categoryId] : null;
  const meta = [bill.dueDay ? `vence el ${bill.dueDay}` : null, categoryName]
    .filter(Boolean)
    .join(" · ");

  function unmark() {
    startTransition(async () => {
      const r = await unmarkFixedBillPaid({ billId: bill.id, period });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        payment?.expenseId
          ? "Desmarcado. El gasto sigue en Movimientos."
          : "Desmarcado",
      );
      router.refresh();
    });
  }

  return (
    <div className="py-3">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-7" aria-hidden>
          {bill.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="block max-w-full truncate text-left font-medium hover:underline"
          >
            {bill.name}
          </button>
          {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className="font-medium tabular-nums">
            {payment
              ? formatMoney(payment.amountCents, payment.currency)
              : `~${formatMoney(bill.amountCents, bill.currency)}`}
          </p>
          <Badge variant={badge.variant} className={badge.className}>
            {badge.label}
          </Badge>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 pl-9">
        {payment ? (
          <>
            <span className="text-xs text-muted-foreground">
              Pagado el {fmtDay(payment.paidOn)}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {payment.expenseId && (
                <Button
                  variant="outline"
                  className="h-10"
                  render={<Link href={`/expenses/${payment.expenseId}`}>Ver gasto</Link>}
                />
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      className="size-10"
                      aria-label="Opciones del pago"
                      disabled={pending}
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={unmark} disabled={pending}>
                    <Undo2 className="size-4" />
                    Desmarcar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        ) : (
          <>
            <Button className="h-10 flex-1" onClick={() => setPayOpen(true)}>
              Ya lo pagué
            </Button>
            <Button variant="outline" className="h-10 flex-1" onClick={() => setLinkOpen(true)}>
              Vincular
            </Button>
          </>
        )}
      </div>

      <FixedBillFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        bill={bill}
        categories={categories}
        currencies={currencies}
        primaryCurrency={primaryCurrency}
      />
      {!payment && (
        <>
          <MarkPaidDialog
            open={payOpen}
            onOpenChange={setPayOpen}
            bill={bill}
            period={period}
            defaultDate={defaultPaidOn(bill, period, today)}
            categories={categories}
          />
          <LinkExpenseDialog
            open={linkOpen}
            onOpenChange={setLinkOpen}
            bill={bill}
            period={period}
            candidates={candidates}
            categoryNames={categoryNames}
            onMarkPaid={() => setPayOpen(true)}
          />
        </>
      )}
    </div>
  );
}

/** Fila compacta para un fijo archivado (tocar = editar / reactivar). */
export function ArchivedBillRow({
  bill,
  categories,
  currencies,
  primaryCurrency,
}: {
  bill: FixedBillMonthRow["bill"];
  categories: { id: string; name: string }[];
  currencies: string[];
  primaryCurrency: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-10 w-full items-center gap-3 py-2 text-left text-sm text-muted-foreground"
      >
        <span aria-hidden>{bill.emoji}</span>
        <span className="min-w-0 flex-1 truncate">{bill.name}</span>
        <span className="shrink-0">{formatMoney(bill.amountCents, bill.currency)}</span>
      </button>
      <FixedBillFormDialog
        open={open}
        onOpenChange={setOpen}
        bill={bill}
        categories={categories}
        currencies={currencies}
        primaryCurrency={primaryCurrency}
      />
    </>
  );
}
