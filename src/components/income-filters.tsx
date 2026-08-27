"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { INCOME_METHODS, incomeMethodMeta } from "@/lib/income-methods";

const ALL = "__all__";

export function IncomeFilters({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string | undefined) {
    const sp = new URLSearchParams(params);
    if (value && value !== ALL) sp.set(key, value);
    else sp.delete(key);
    router.push(`${pathname}?${sp.toString()}`);
  }

  const hasFilters = ["from", "to", "categoryId", "method"].some((k) =>
    params.get(k),
  );

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input
            type="date"
            defaultValue={params.get("from") ?? ""}
            onChange={(e) => set("from", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input
            type="date"
            defaultValue={params.get("to") ?? ""}
            onChange={(e) => set("to", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Fuente</Label>
          <Select
            items={{
              [ALL]: "Todas",
              ...Object.fromEntries(categories.map((c) => [c.id, c.name])),
            }}
            value={params.get("categoryId") ?? ALL}
            onValueChange={(v) => set("categoryId", v ?? undefined)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Medio</Label>
          <Select
            items={{
              [ALL]: "Todos",
              ...Object.fromEntries(
                INCOME_METHODS.map((m) => [m, incomeMethodMeta[m].label]),
              ),
            }}
            value={params.get("method") ?? ALL}
            onValueChange={(v) => set("method", v ?? undefined)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {INCOME_METHODS.map((m) => {
                const { label, Icon } = incomeMethodMeta[m];
                return (
                  <SelectItem key={m} value={m}>
                    <Icon className="size-4 text-muted-foreground" />
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}
