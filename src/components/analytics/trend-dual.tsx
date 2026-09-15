import { formatMoney } from "@/lib/money";
import type { MonthlyTrend } from "@/lib/analytics";

export function TrendDual({
  data,
  currency = "ARS",
}: {
  data: MonthlyTrend;
  currency?: string;
}) {
  const formatCents = (c: number) => formatMoney(c, currency);
  const max = Math.max(1, ...data.flatMap((d) => [d.netCents, d.incomeCents]));
  // Escala en raíz cuadrada: comprime el mes outlier y evita que el resto
  // del año quede aplastado contra el eje (ver [[analytics-v2]]).
  const scale = (v: number) => (Math.sqrt(Math.max(v, 0)) / Math.sqrt(max)) * 100;
  const peak = data.reduce((m, d) => (d.netCents > m.netCents ? d : m), data[0]);
  const compact = (c: number) => {
    const a = Math.abs(c) / 100;
    if (a >= 1e6) return "$" + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".0", "") + "M";
    if (a >= 1e3) return "$" + Math.round(a / 1e3) + "k";
    return formatMoney(c, currency);
  };

  return (
    <div>
      <div className="flex h-[130px] items-end gap-[5px] pt-4">
        {data.map((d) => (
          <div key={d.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="relative flex h-full w-full items-end justify-center gap-[2px]">
              {d.month === peak.month && peak.netCents > 0 && (
                <span className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.56rem] font-medium text-muted-foreground">
                  {compact(d.netCents)}
                </span>
              )}
              <div
                className="w-[42%] rounded-t-[3px] bg-destructive/75"
                style={{ height: `${Math.max(scale(d.netCents), 1)}%` }}
                title={`Gastos ${d.label}: ${formatCents(d.netCents)}`}
              />
              <div
                className="w-[42%] rounded-t-[3px] bg-emerald-500/75"
                style={{ height: `${Math.max(scale(d.incomeCents), 1)}%` }}
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
