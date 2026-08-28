import { formatMoney } from "@/lib/money";
import type { SpendPace } from "@/lib/analytics";

const W = 320;
const H = 120;
const P = 6;

export function PaceChart({
  pace,
  currency = "ARS",
}: {
  pace: SpendPace;
  currency?: string;
}) {
  const formatCents = (c: number) => formatMoney(c, currency);
  const max = Math.max(1, pace.prevFullCents, pace.curTotalCents);
  const px = (i: number) => P + (i / (pace.daysInMonth - 1)) * (W - P * 2);
  const py = (v: number) => H - P - (v / max) * (H - P * 2);
  const path = (arr: number[]) =>
    arr.map((v, i) => (i ? "L" : "M") + px(i).toFixed(1) + " " + py(v).toFixed(1)).join(" ");

  const diff = pace.curTotalCents - pace.prevToDateCents;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[120px] w-full">
        <path d={path(pace.prevCum)} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />
        <path d={path(pace.curCum)} fill="none" stroke="var(--primary)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {pace.curCum.length > 0 && (
          <circle cx={px(pace.curCum.length - 1)} cy={py(pace.curTotalCents)} r="3.4" fill="var(--primary)" />
        )}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <i className="block h-[3px] w-3.5 rounded-full bg-primary" /> Este mes
        </span>
        <span className="flex items-center gap-1.5">
          <i className="block h-[3px] w-3.5 rounded-full bg-muted-foreground/70" /> {pace.prevMonthLabel}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {diff >= 0 ? (
          <>
            Vas <b className="text-destructive">{formatCents(diff)}</b> por encima del ritmo de{" "}
            {pace.prevMonthLabel}.
          </>
        ) : (
          <>
            Vas <b className="text-emerald-500">{formatCents(-diff)}</b> por debajo del ritmo de{" "}
            {pace.prevMonthLabel}.
          </>
        )}
      </p>
    </div>
  );
}
