import { formatCents } from "@/lib/money";

type Point = {
  month: string;
  label: string;
  grossCents: number;
  reimbursedCents: number;
  netCents: number;
};

/** Barras del neto mensual (últimos N meses). SVG, sin JS. */
export function TrendChart({ data }: { data: Point[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(0, d.netCents)));
  const W = 100;
  const H = 44;
  const gap = 1.4;
  const bw = (W - gap * (data.length - 1)) / data.length;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-32 w-full"
        role="img"
        aria-label="Gasto neto por mes"
      >
        <line
          x1="0"
          y1={H - 0.4}
          x2={W}
          y2={H - 0.4}
          stroke="var(--border)"
          strokeWidth="0.4"
        />
        {data.map((d, i) => {
          const h = (Math.max(0, d.netCents) / max) * (H - 3);
          const x = i * (bw + gap);
          const last = i === data.length - 1;
          return (
            <rect
              key={d.month}
              x={x}
              y={H - h - 0.4}
              width={bw}
              height={Math.max(h, 0.6)}
              rx="0.8"
              fill={last ? "var(--glow)" : "var(--primary)"}
              opacity={last ? 0.95 : 0.55}
            >
              <title>{`${d.label}: ${formatCents(d.netCents)} neto`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[0.6rem] text-muted-foreground">
        {data.map((d, i) => (
          <span key={d.month} className={i % 2 ? "opacity-0 sm:opacity-100" : ""}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
