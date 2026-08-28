"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { currencyMeta, type Currency } from "@/lib/currencies";
import { cn } from "@/lib/utils";

export function CurrencyTabs({
  currencies,
  value,
}: {
  currencies: string[];
  value: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (currencies.length < 2) return null;

  function set(c: string) {
    const sp = new URLSearchParams(params);
    sp.set("cur", c);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="flex gap-1 rounded-lg border p-1 text-xs">
      {currencies.map((c) => (
        <button
          key={c}
          onClick={() => set(c)}
          aria-pressed={c === value}
          className={cn(
            "flex-1 whitespace-nowrap rounded-md px-2 py-1.5 font-medium transition-colors",
            c === value
              ? "bg-primary/20 text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {currencyMeta[c as Currency]?.symbol ?? c} {c}
        </button>
      ))}
    </div>
  );
}
