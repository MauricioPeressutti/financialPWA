"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  RANGE_LABELS,
  RANGE_ORDER,
  type AnalyticsRange,
} from "@/lib/analytics-range";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function AnalyticsRange({
  value,
  custom,
}: {
  value: AnalyticsRange;
  custom: { from: string; to: string } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [open, setOpen] = useState(!!custom);
  const [from, setFrom] = useState(custom?.from ?? "");
  const [to, setTo] = useState(custom?.to ?? "");

  const today = new Date().toISOString().slice(0, 10);

  function push(sp: URLSearchParams) {
    router.push(`${pathname}?${sp.toString()}`);
  }

  function setPreset(r: AnalyticsRange) {
    const sp = new URLSearchParams(params);
    sp.set("range", r);
    sp.delete("from");
    sp.delete("to");
    setOpen(false);
    push(sp);
  }

  function applyCustom(f: string, t: string) {
    if (!f || !t) return;
    const [lo, hi] = f <= t ? [f, t] : [t, f];
    const sp = new URLSearchParams(params);
    sp.set("from", lo);
    sp.set("to", hi);
    sp.delete("range");
    push(sp);
  }

  const btn = (active: boolean) =>
    cn(
      "flex-1 whitespace-nowrap rounded-md px-2 py-1.5 transition-colors",
      active
        ? "bg-primary/20 text-foreground"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1 rounded-lg border p-1 text-xs">
        {RANGE_ORDER.map((r) => (
          <button
            key={r}
            onClick={() => setPreset(r)}
            aria-pressed={!custom && r === value}
            className={btn(!custom && r === value)}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-pressed={!!custom}
          aria-label="Rango personalizado"
          className={cn(btn(!!custom), "max-w-[3rem]")}
        >
          📅
        </button>
      </div>

      {open && (
        <div className="flex items-end gap-2 rounded-lg border p-2 text-xs">
          <label className="flex-1 space-y-1">
            <span className="block text-muted-foreground">Desde</span>
            <Input
              type="date"
              value={from}
              max={to || today}
              onChange={(e) => {
                setFrom(e.target.value);
                applyCustom(e.target.value, to);
              }}
              className="h-8"
            />
          </label>
          <label className="flex-1 space-y-1">
            <span className="block text-muted-foreground">Hasta</span>
            <Input
              type="date"
              value={to}
              min={from || undefined}
              max={today}
              onChange={(e) => {
                setTo(e.target.value);
                applyCustom(from, e.target.value);
              }}
              className="h-8"
            />
          </label>
        </div>
      )}
    </div>
  );
}
