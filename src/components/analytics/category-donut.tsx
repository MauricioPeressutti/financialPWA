"use client";

import { useMemo, useState } from "react";

import { formatCents } from "@/lib/money";

type Slice = {
  name: string;
  grossCents: number;
  netCents: number;
  count: number;
  pct: number;
};

const catVar = (i: number) => `var(--cat-${((i % 6) + 6) % 6})`;
const compact = (c: number) => {
  const a = Math.abs(c) / 100;
  if (a >= 1e6) return "$" + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".0", "") + "M";
  if (a >= 1e3) return "$" + Math.round(a / 1e3) + "k";
  return formatCents(c);
};

export function CategoryDonut({
  slices,
  colors,
}: {
  slices: Slice[];
  colors: Record<string, number>;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [table, setTable] = useState(false);

  const { data, total } = useMemo(() => {
    const sorted = [...slices].sort((a, b) => b.grossCents - a.grossCents);
    let head = sorted.slice(0, 6);
    if (sorted.length > 6) {
      const tail = sorted.slice(5);
      const rest = tail.reduce(
        (acc, s) => ({
          name: "Otros",
          grossCents: acc.grossCents + s.grossCents,
          netCents: acc.netCents + s.netCents,
          count: acc.count + s.count,
          pct: acc.pct + s.pct,
        }),
        { name: "Otros", grossCents: 0, netCents: 0, count: 0, pct: 0 },
      );
      head = [...sorted.slice(0, 5), rest];
    }
    const t = head.reduce((a, s) => a + s.grossCents, 0) || 1;
    return { data: head, total: t };
  }, [slices]);

  const R = 42;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const arcs = data.map((s) => {
    const frac = s.grossCents / total;
    const arc = { s, frac, offset: acc };
    acc += frac;
    return arc;
  });

  const shown = locked ?? active;
  const cur = shown ? data.find((d) => d.name === shown) : null;

  return (
    <div>
      <div className="flex items-center gap-4">
        <div
          className={`relative size-[148px] shrink-0 ${shown ? "[&_.seg]:opacity-30" : ""}`}
        >
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            {arcs.map(({ s, frac, offset }) => (
              <circle
                key={s.name}
                className="seg cursor-pointer transition-[opacity,stroke-width] duration-200"
                cx="50"
                cy="50"
                r={R}
                fill="none"
                strokeWidth={shown === s.name ? 18 : 15}
                stroke={catVar(colors[s.name] ?? 5)}
                strokeDasharray={`${(frac * C).toFixed(2)} ${(C - frac * C).toFixed(2)}`}
                strokeDashoffset={(-offset * C).toFixed(2)}
                style={{ opacity: shown === s.name ? 1 : undefined }}
                onMouseEnter={() => setActive(s.name)}
                onMouseLeave={() => setActive(null)}
                onClick={() => setLocked((l) => (l === s.name ? null : s.name))}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {cur ? (
              <>
                <span className="text-sm font-bold tabular-nums">{compact(cur.grossCents)}</span>
                <span className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">
                  {cur.name}
                </span>
                <span className="text-[0.66rem] text-muted-foreground tabular-nums">
                  {((cur.grossCents / total) * 100).toFixed(0)}% · {cur.count}
                </span>
              </>
            ) : (
              <>
                <span className="text-sm font-bold tabular-nums">{compact(total)}</span>
                <span className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">
                  Total
                </span>
              </>
            )}
          </div>
        </div>

        <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
          {data.map((s) => (
            <li key={s.name}>
              <button
                className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted aria-pressed:bg-muted"
                aria-pressed={shown === s.name}
                onMouseEnter={() => !locked && setActive(s.name)}
                onMouseLeave={() => !locked && setActive(null)}
                onClick={() => setLocked((l) => (l === s.name ? null : s.name))}
              >
                <span
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ background: catVar(colors[s.name] ?? 5) }}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                  {compact(s.grossCents)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        className="mt-3 text-xs font-medium text-primary"
        onClick={() => setTable((t) => !t)}
      >
        {table ? "Ocultar tabla" : "Ver tabla"}
      </button>
      {table && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-xs tabular-nums">
            <thead>
              <tr className="text-muted-foreground [&_th]:border-b [&_th]:border-border [&_th]:py-1.5 [&_th]:text-right [&_th:first-child]:text-left">
                <th>Categoría</th>
                <th>Bruto</th>
                <th>Neto</th>
                <th>%</th>
                <th>Mov.</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr
                  key={s.name}
                  className="[&_td]:border-b [&_td]:border-border/60 [&_td]:py-1.5 [&_td]:text-right [&_td:first-child]:text-left"
                >
                  <td>{s.name}</td>
                  <td>{formatCents(s.grossCents)}</td>
                  <td>{formatCents(s.netCents)}</td>
                  <td>{((s.grossCents / total) * 100).toFixed(0)}%</td>
                  <td>{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
