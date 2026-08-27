import { formatCents } from "@/lib/money";

/** Fila con barra de magnitud (accent), etiqueta y valor. */
export function BarRow({
  label,
  sublabel,
  valueCents,
  pct,
  meta,
  fill = "var(--primary)",
}: {
  label: string;
  sublabel?: string;
  valueCents: number;
  pct: number;
  meta?: string;
  fill?: string;
}) {
  return (
    <div className="space-y-1 py-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">
          {label}
          {sublabel ? (
            <span className="text-muted-foreground"> · {sublabel}</span>
          ) : null}
        </span>
        <span className="shrink-0 font-medium tabular-nums">
          {formatCents(valueCents)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.max(pct, 1.5)}%`, background: fill }}
          />
        </div>
        <span className="w-16 shrink-0 text-right text-[0.7rem] text-muted-foreground tabular-nums">
          {pct.toFixed(0)}%{meta ? ` · ${meta}` : ""}
        </span>
      </div>
    </div>
  );
}

const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function WeekdayBars({
  data,
}: {
  data: { dow: number; grossCents: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.grossCents));
  const top = [...data].sort((a, b) => b.grossCents - a.grossCents)[0];
  return (
    <div className="flex items-end justify-between gap-1.5" aria-hidden>
      {data.map((d) => {
        const h = (d.grossCents / max) * 100;
        const isTop = d.dow === top.dow && d.grossCents > 0;
        return (
          <div key={d.dow} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-20 w-full items-end">
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.max(h, 3)}%`,
                  background: isTop ? "var(--glow)" : "var(--primary)",
                  opacity: isTop ? 0.95 : 0.45,
                }}
                title={`${DOW[d.dow]}: ${formatCents(d.grossCents)}`}
              />
            </div>
            <span className="text-[0.6rem] text-muted-foreground">
              {DOW[d.dow]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
