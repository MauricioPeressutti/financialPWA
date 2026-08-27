"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  RANGE_LABELS,
  RANGE_ORDER,
  type AnalyticsRange,
} from "@/lib/analytics-range";
import { cn } from "@/lib/utils";

const ORDER = RANGE_ORDER;

export function AnalyticsRange({ value }: { value: AnalyticsRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(r: AnalyticsRange) {
    const sp = new URLSearchParams(params);
    sp.set("range", r);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="flex gap-1 rounded-lg border p-1 text-xs">
      {ORDER.map((r) => (
        <button
          key={r}
          onClick={() => set(r)}
          aria-pressed={r === value}
          className={cn(
            "flex-1 whitespace-nowrap rounded-md px-2 py-1.5 transition-colors",
            r === value
              ? "bg-primary/20 text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {RANGE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}
