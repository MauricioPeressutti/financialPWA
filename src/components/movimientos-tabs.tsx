"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export const MOVIMIENTOS_TABS = [
  { href: "/movimientos", label: "Gastos" },
  { href: "/movimientos/ingresos", label: "Ingresos" },
  { href: "/movimientos/fijos", label: "Fijos" },
];

/** "Gastos" (/movimientos) solo en la ruta exacta; el resto, también en sus subrutas. */
export function isMovimientosTabActive(href: string, pathname: string): boolean {
  if (href === "/movimientos") return pathname === "/movimientos";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MovimientosTabs() {
  const pathname = usePathname();
  return (
    <div className="flex rounded-lg bg-muted p-1 text-sm">
      {MOVIMIENTOS_TABS.map((t) => {
        const active = isMovimientosTabActive(t.href, pathname);
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
