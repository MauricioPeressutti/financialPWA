import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { shiftPeriod } from "@/lib/fixed-bills";
import { cn } from "@/lib/utils";

/** "2026-11-01" -> "noviembre 2026" */
function periodLabel(period: string): string {
  return new Date(`${period}T12:00:00Z`).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const href = (p: string) => `/movimientos/fijos?mes=${p.slice(0, 7)}`;

const arrow =
  "grid size-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground";

/** Selector de mes ‹ noviembre 2026 › con links a ?mes=YYYY-MM. */
export function FixedMonthPicker({ period, max }: { period: string; max: string }) {
  const prev = shiftPeriod(period, -1);
  const next = shiftPeriod(period, 1);
  const canNext = next <= max;

  return (
    <div className="flex items-center justify-between">
      <Link href={href(prev)} className={arrow} aria-label="Mes anterior">
        <ChevronLeft className="size-5" />
      </Link>
      <span className="font-medium">{periodLabel(period)}</span>
      {canNext ? (
        <Link href={href(next)} className={arrow} aria-label="Mes siguiente">
          <ChevronRight className="size-5" />
        </Link>
      ) : (
        <span className={cn(arrow, "pointer-events-none opacity-30")} aria-hidden>
          <ChevronRight className="size-5" />
        </span>
      )}
    </div>
  );
}
