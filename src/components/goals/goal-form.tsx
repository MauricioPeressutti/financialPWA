"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createGoal, updateGoal } from "@/lib/actions/goals";
import { currencyMeta, type Currency } from "@/lib/currencies";
import { cn } from "@/lib/utils";

const EMOJIS = ["🎯", "✈️", "🏠", "🚗", "💻", "💍", "🎓", "🛟", "🎁", "📱", "🛋️", "🐣"];

type Props = {
  currencies: string[];
  goal?: {
    id: string;
    name: string;
    emoji: string;
    targetAmount: string;
    currency: string;
    scope: string;
    targetDate: string;
  };
};

export function GoalForm({ currencies, goal }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(goal?.name ?? "");
  const [emoji, setEmoji] = useState(goal?.emoji ?? "🎯");
  const [amount, setAmount] = useState(goal?.targetAmount ?? "");
  const [currency, setCurrency] = useState(goal?.currency ?? currencies[0] ?? "ARS");
  const [scope, setScope] = useState(goal?.scope ?? "shared");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");

  const sym = currencyMeta[currency as Currency]?.symbol ?? "$";

  function submit() {
    startTransition(async () => {
      if (goal) {
        const res = await updateGoal(goal.id, {
          name,
          emoji,
          targetAmount: amount,
          currency,
          targetDate,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Objetivo actualizado");
        router.push(`/objetivos/${goal.id}`);
      } else {
        const res = await createGoal({
          name,
          emoji,
          targetAmount: amount,
          currency,
          scope,
          targetDate,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Objetivo creado");
        router.push(`/objetivos/${res.id}`);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Nombre</Label>
        <Input
          value={name}
          autoFocus
          placeholder="Ej: Viaje a Brasil"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Ícono</Label>
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={emoji === e}
              onClick={() => setEmoji(e)}
              className={cn(
                "grid size-9 place-items-center rounded-lg border text-lg",
                emoji === e ? "border-primary bg-primary/10" : "border-border",
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Monto meta</Label>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-md border bg-[var(--field-surface)] px-3">
            <span className="text-sm text-muted-foreground">{sym}</span>
            <Input
              inputMode="numeric"
              value={amount}
              placeholder="0"
              className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <select
            className="rounded-md border bg-[var(--field-surface)] px-2.5 text-sm font-semibold"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {currencyMeta[c as Currency]?.symbol ?? c} {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!goal && (
        <div className="space-y-1.5">
          <Label>¿De quién es?</Label>
          <div className="flex gap-1 rounded-lg border p-1 text-sm">
            {[
              { k: "shared", label: "Compartido" },
              { k: "personal", label: "Personal" },
            ].map((o) => (
              <button
                key={o.k}
                type="button"
                aria-pressed={scope === o.k}
                onClick={() => setScope(o.k)}
                className={cn(
                  "flex-1 rounded-md py-1.5 font-medium transition-colors",
                  scope === o.k
                    ? "bg-primary/20 text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {scope === "shared"
              ? "Todo el equipo lo ve y puede aportar."
              : "Solo vos lo ves y aportás."}
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="targetDate">Fecha objetivo (opcional)</Label>
        <Input
          id="targetDate"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
      </div>

      <Button className="w-full" disabled={pending} onClick={submit}>
        {pending ? "Guardando…" : goal ? "Guardar cambios" : "Crear objetivo"}
      </Button>
    </div>
  );
}
