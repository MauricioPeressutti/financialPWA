import { formatCents } from "@/lib/money";
import type { MonthlyTrend } from "@/lib/analytics";

export function TrendDual({ data }: { data: MonthlyTrend }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.netCents, d.incomeCents]));

  return (
    <div>
      <div className="flex h-[130px] items-end gap-[5px] pt-2">
        {data.map((d) => (
          <div key={d.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="flex h-full w-full items-end justify-center gap-[2px]">
              <div
                className="w-[42%] rounded-t-[3px] bg-destructive/75"
                style={{ height: `${Math.max((d.netCents / max) * 100, 1)}%` }}
                title={`Gastos ${d.label}: ${formatCents(d.netCents)}`}
              />
              <div
                className="w-[42%] rounded-t-[3px] bg-emerald-500/75"
                style={{ height: `${Math.max((d.incomeCents / max) * 100, 1)}%` }}
                title={`Ingresos ${d.label}: ${formatCents(d.incomeCents)}`}
              />
            </div>
            <span className="text-[0.56rem] text-muted-foreground">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <i className="block size-2 rounded-[2px] bg-destructive/75" /> Gastos
        </span>
        <span className="flex items-center gap-1.5">
          <i className="block size-2 rounded-[2px] bg-emerald-500/75" /> Ingresos
        </span>
      </div>
    </div>
  );
}
