"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/analytics", label: "Gastos" },
  { href: "/analytics/ingresos", label: "Ingresos" },
];

export function AnalyticsTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const qs = params.toString();

  return (
    <div className="flex rounded-lg bg-muted p-1 text-sm">
      {TABS.map((t) => {
        const active =
          t.href === "/analytics"
            ? pathname === "/analytics"
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={qs ? `${t.href}?${qs}` : t.href}
            className={cn(
              "flex-1 rounded-md py-1.5 text-center font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
