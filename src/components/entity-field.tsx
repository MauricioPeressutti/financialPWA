"use client";

import { useId } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KNOWN_ENTITIES } from "@/lib/entities";

/**
 * Campo opcional "Entidad" (banco / billetera). Texto libre con datalist:
 * sugerencias = entidades ya usadas por el equipo + las más comunes.
 * Se usa con react-hook-form: <EntityField register={form.register("entity")} .../>
 */
export function EntityField({
  register,
  used = [],
}: {
  register: UseFormRegisterReturn;
  used?: string[];
}) {
  const listId = useId();
  const options = Array.from(new Set([...used, ...KNOWN_ENTITIES]));

  return (
    <div className="space-y-1.5">
      <Label htmlFor="entity">Banco / billetera (opcional)</Label>
      <Input
        id="entity"
        list={listId}
        autoComplete="off"
        placeholder="Ej: Galicia, Mercado Pago, Ualá…"
        maxLength={40}
        {...register}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}
