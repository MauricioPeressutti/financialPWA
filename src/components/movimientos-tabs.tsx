"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/movimientos", label: "Gastos" },
  { href: "/movimientos/ingresos", label: "Ingresos" },
];

export function MovimientosTabs() {
  const pathname = usePathname();
  return (
    <div className="flex rounded-lg bg-muted p-1 text-sm">
      {TABS.map((t) => {
        const active =
          t.href === "/movimientos"
            ? pathname === "/movimientos"
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
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
