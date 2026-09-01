"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  dismissStatement,
  markStatementPaid,
} from "@/lib/actions/card-statements";
import type { listStatements } from "@/lib/card-statements";
import { fmtDay } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";

type Row = Awaited<ReturnType<typeof listStatements>>[number];

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "sin importar", cls: "text-cyan-500 border-cyan-500/40 bg-cyan-500/10" },
  reminder_only: {
    label: "solo aviso",
    cls: "text-muted-foreground border-border",
  },
  imported: {
    label: "consumos cargados",
    cls: "text-muted-foreground border-border",
  },
  paid: { label: "✓ pagada", cls: "text-emerald-500 border-emerald-500/40 bg-emerald-500/10" },
  dismissed: { label: "descartada", cls: "text-muted-foreground border-border" },
};

function daysTo(due: string): number {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round(
    (new Date(due + "T00:00:00").getTime() - t.getTime()) / 86400000,
  );
}

export function StatementCard({ s }: { s: Row }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const st = STATUS[s.status] ?? STATUS.reminder_only;
  const d = daysTo(s.dueDate);
  const overdue = d < 0 && s.status !== "paid";
  const soon = d >= 0 && d <= 5 && s.status !== "paid";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error ?? "Error");
        return;
      }
      toast.success(msg);
      router.refresh();
    });

  return (
    <div className="cosmic-panel rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-gradient-to-br from-[#6fffe9]/25 to-[#5bc0be]/15">
            <CreditCard className="size-4 text-muted-foreground" />
          </span>
          <div>
            <p className="text-sm font-semibold">{s.label}</p>
            <p className="text-xs text-muted-foreground">
              {s.closingDate ? `cierre ${fmtDay(s.closingDate)} · ` : ""}
              vence {fmtDay(s.dueDate)}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold ${
            overdue
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : soon
                ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                : "border-border text-muted-foreground"
          }`}
        >
          {overdue
            ? `⚠ venció ${fmtDay(s.dueDate)}`
            : soon
              ? d === 0
                ? "⚠ vence hoy"
                : `⚠ en ${d} día${d === 1 ? "" : "s"}`
              : `vence ${fmtDay(s.dueDate)}`}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="font-semibold tabular-nums">
          {formatMoney(s.totalArsCents, "ARS")}
          {s.totalUsdCents ? (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              + {formatMoney(s.totalUsdCents, "USD")}
            </span>
          ) : null}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold ${st.cls}`}
        >
          {s.importedCount > 0 ? `${s.importedCount} consumos` : st.label}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {s.status !== "paid" && (
          <Button
            size="sm"
            render={<Link href={`/tarjetas/${s.id}/revisar`}>📥 Revisar consumos</Link>}
          />
        )}
        {s.status !== "paid" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => markStatementPaid(s.id, true), "Marcada como pagada")}
          >
            💳 Pagué
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => markStatementPaid(s.id, false), "Reabierta")}
          >
            Reabrir
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                "¿Descartar este resumen? Se borran los consumos que se hayan importado desde él.",
              )
            )
              return;
            run(() => dismissStatement(s.id), "Descartado");
          }}
        >
          Descartar
        </Button>
      </div>
    </div>
  );
}
