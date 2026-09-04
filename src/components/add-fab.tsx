"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * FAB de "cargar movimiento": un solo botón que al tocarlo despliega
 * "Gasto" e "Ingreso". Toca afuera o Escape para cerrar.
 */
export function AddFab() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* backdrop para cerrar tocando afuera */}
      {open && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 cursor-default bg-background/50 backdrop-blur-[1px] motion-safe:animate-in motion-safe:fade-in-0"
        />
      )}

      <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-40 flex flex-col items-end gap-3">
        {open && (
          <div className="flex flex-col items-end gap-2 duration-150 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2">
            <Link
              href="/incomes/new"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-full border-0 bg-emerald-600 py-2.5 pr-5 pl-4 text-sm font-medium text-white shadow-lg hover:bg-emerald-700"
            >
              <ArrowUpRight className="size-4" />
              Ingreso
            </Link>
            <Link
              href="/expenses/new"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-full bg-primary py-2.5 pr-5 pl-4 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90"
            >
              <ArrowDownRight className="size-4" />
              Gasto
            </Link>
          </div>
        )}

        <button
          type="button"
          aria-label={open ? "Cerrar" : "Cargar movimiento"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "grid size-14 place-items-center rounded-full shadow-lg transition-colors",
            open
              ? "bg-muted text-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          <Plus
            className={cn(
              "size-6 transition-transform duration-200",
              open && "rotate-45",
            )}
          />
        </button>
      </div>
    </>
  );
}
