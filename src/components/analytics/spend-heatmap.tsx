"use client";

import { useMemo, useState } from "react";

import { formatCents } from "@/lib/money";

type Day = { date: string; cents: number; count: number };

const HEAT = ["--heat-0", "--heat-1", "--heat-2", "--heat-3", "--heat-4"];
const MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MAX_WEEKS = 26;

export function SpendHeatmap({ days, to }: { days: Day[]; to: string }) {
  const [tip, setTip] = useState<{ x: number; y: number; t: string; r: string } | null>(null);

  const { cells, weeks, levels } = useMemo(() => {
    const map = new Map(days.map((d) => [d.date, d]));
    const end = new Date(to + "T00:00:00");
    const today = new Date();
    const last = end > today ? today : end;
    // arranca un lunes
    const start = new Date(last);
    start.setDate(start.getDate() - (MAX_WEEKS * 7 - 1));
    while (start.getDay() !== 1) start.setDate(start.getDate() - 1);

    const wk = Math.ceil((last.getTime() - start.getTime()) / 86400000 / 7) + 1;
    const vals: number[] = [];
    const cs: { date: string; cents: number; count: number; future: boolean }[] = [];
    for (let i = 0; i < wk * 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      if (d > last) {
        cs.push({ date: key, cents: 0, count: 0, future: true });
        continue;
      }
      const hit = map.get(key);
      const cents = hit?.cents ?? 0;
      if (cents > 0) vals.push(cents);
      cs.push({ date: key, cents, count: hit?.count ?? 0, future: false });
    }
    vals.sort((a, b) => a - b);
    const q = (p: number) => (vals.length ? vals[Math.floor(p * (vals.length - 1))] : 0);
    return { cells: cs, weeks: wk, levels: [q(0.25), q(0.5), q(0.8)] };
  }, [days, to]);

  const lvl = (c: number) =>
    c <= 0 ? 0 : c <= levels[0] ? 1 : c <= levels[1] ? 2 : c <= levels[2] ? 3 : 4;

  // etiquetas de mes por columna
  const monthLabels: string[] = [];
  let prevM = -1;
  for (let w = 0; w < weeks; w++) {
    const d = new Date(cells[w * 7].date + "T00:00:00");
    monthLabels.push(d.getMonth() !== prevM ? MON[d.getMonth()] : "");
    prevM = d.getMonth();
  }

  return (
    <div
      className="relative"
      onMouseLeave={() => setTip(null)}
    >
      <div className="overflow-x-auto pb-1">
        <div className="mb-1 flex min-w-max gap-[3px] text-[0.6rem] text-muted-foreground">
          {monthLabels.map((m, i) => (
            <span key={i} className="w-[13px] shrink-0">
              {m}
            </span>
          ))}
        </div>
        <div
          className="grid min-w-max grid-flow-col grid-rows-7 gap-[3px]"
          onMouseMove={(e) => {
            const t = e.target as HTMLElement;
            const idx = t.dataset?.i;
            if (idx == null) return;
            const c = cells[+idx];
            if (c.future) return;
            const rect = (e.currentTarget.closest(".relative") as HTMLElement).getBoundingClientRect();
            setTip({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
              t: new Date(c.date + "T00:00:00").toLocaleDateString("es-AR", {
                weekday: "long",
                day: "numeric",
                month: "short",
              }),
              r: c.cents > 0 ? `${formatCents(c.cents)} · ${c.count} mov.` : "sin gastos",
            });
          }}
        >
          {cells.map((c, i) => (
            <span
              key={i}
              data-i={i}
              className="size-[13px] rounded-[3px] border border-white/5"
              style={{
                background: c.future ? "transparent" : `var(${HEAT[lvl(c.cents)]})`,
                visibility: c.future ? "hidden" : "visible",
              }}
            />
          ))}
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[0.68rem] text-muted-foreground">
        <span>
          {cells.filter((c) => !c.future && c.cents > 0).length} días con gasto
        </span>
        <span className="flex items-center gap-[3px]">
          menos
          {HEAT.map((h) => (
            <i key={h} className="size-3 rounded-[3px]" style={{ background: `var(${h})` }} />
          ))}
          más
        </span>
      </div>

      {tip && (
        <div
          className="pointer-events-none absolute z-10 max-w-[200px] rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: Math.min(tip.x + 12, 280),
            top: Math.max(tip.y - 46, 0),
          }}
        >
          <div className="font-semibold capitalize">{tip.t}</div>
          <div className="text-muted-foreground tabular-nums">{tip.r}</div>
        </div>
      )}
    </div>
  );
}
