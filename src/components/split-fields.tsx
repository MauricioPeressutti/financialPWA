"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { effortPercents, splitShares, type SplitMode } from "@/lib/effort";
import { formatMoney, parseAmountToCents } from "@/lib/money";
import { cn } from "@/lib/utils";

export type SplitMember = {
  userId: string;
  name: string;
  incomeCents: number;
};

export function SplitFields({
  form,
  members,
  currency,
}: {
  form: any;
  members: SplitMember[];
  currency: string;
}) {
  const mode: string = form.watch("splitMode") || "none";
  const on = mode !== "none";
  const paidBy: string = form.watch("paidByUserId") || "";
  const customRaw: string = form.watch("splitCustom") || "";
  const amount: string = form.watch("amount") || "";

  const custom: Record<string, number> = useMemo(() => {
    try {
      return customRaw ? (JSON.parse(customRaw) as Record<string, number>) : {};
    } catch {
      return {};
    }
  }, [customRaw]);

  const twoPeople = members.length === 2;
  const other = twoPeople
    ? (members.find((m) => m.userId !== paidBy) ?? members[1])
    : null;

  // "Se lo cubrí": custom con una sola persona en 100 (la que no pagó)
  const isLent =
    mode === "custom" &&
    Object.values(custom).filter((v) => v > 0).length === 1;

  type UiMode = "even" | "proportional" | "lent" | "custom";
  const uiMode: UiMode =
    mode === "even"
      ? "even"
      : mode === "proportional"
        ? "proportional"
        : isLent
          ? "lent"
          : "custom";

  const cents = parseAmountToCents(amount) ?? 0;
  const shares = on
    ? splitShares(
        cents,
        mode as SplitMode,
        members,
        mode === "custom" ? custom : undefined,
      )
    : [];
  const pcts = effortPercents(members);
  const first = (n: string) => n.split(/\s+/)[0];
  const nameOf = (id: string) => {
    const n = members.find((m) => m.userId === id)?.name;
    return n ? first(n) : "—";
  };

  function toggle() {
    if (on) {
      form.setValue("splitMode", "none");
      return;
    }
    if (!paidBy && members[0]) form.setValue("paidByUserId", members[0].userId);
    form.setValue("splitMode", "even"); // por defecto: mitades
  }

  function setPaidBy(userId: string) {
    form.setValue("paidByUserId", userId);
    // si estaba "todo del otro", re-apuntar al nuevo "otro"
    if (isLent && twoPeople) {
      const o = members.find((m) => m.userId !== userId);
      if (o) form.setValue("splitCustom", JSON.stringify({ [o.userId]: 100 }));
    }
  }

  function pick(m: UiMode) {
    if (m === "even") form.setValue("splitMode", "even");
    else if (m === "proportional") form.setValue("splitMode", "proportional");
    else if (m === "lent" && other) {
      form.setValue("splitMode", "custom");
      form.setValue("splitCustom", JSON.stringify({ [other.userId]: 100 }));
    } else {
      // "a mano" — arranca vacío para editar
      form.setValue("splitMode", "custom");
      form.setValue("splitCustom", "");
    }
  }

  function setCustomPct(userId: string, val: string) {
    const next = { ...custom, [userId]: Number(val) || 0 };
    form.setValue("splitCustom", JSON.stringify(next));
  }

  if (members.length < 2) return null;

  const owesUser = shares.find((s) => s.userId !== paidBy && s.owedCents > 0);

  const modeBtn = (m: UiMode, label: string) => (
    <button
      key={m}
      type="button"
      aria-pressed={uiMode === m}
      onClick={() => pick(m)}
      className={cn(
        "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
        uiMode === m
          ? "bg-primary/20 text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between rounded-lg border bg-[var(--field-surface)] px-3 py-2.5"
      >
        <span className="text-sm font-medium">Gasto compartido</span>
        <span
          className={cn(
            "relative h-[22px] w-10 rounded-full transition-colors",
            on ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 size-[18px] rounded-full bg-white transition-transform",
              on && "translate-x-[18px]",
            )}
          />
        </span>
      </button>

      {on && (
        <div className="space-y-3 rounded-lg border border-dashed p-3">
          <div>
            <Label className="text-xs">¿Quién lo pagó?</Label>
            <div className="mt-1 flex gap-2">
              {members.map((m) => (
                <button
                  key={m.userId}
                  type="button"
                  aria-pressed={paidBy === m.userId}
                  onClick={() => setPaidBy(m.userId)}
                  className={cn(
                    "flex-1 rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                    paidBy === m.userId
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {first(m.name)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">¿Cómo se reparte?</Label>
            <div
              className={cn(
                "mt-1 grid gap-1 rounded-lg border p-1",
                twoPeople ? "grid-cols-2" : "grid-cols-3",
              )}
            >
              {modeBtn("even", "Mitades")}
              {twoPeople &&
                other &&
                modeBtn("lent", `Todo ${first(other.name)}`)}
              {modeBtn("proportional", "Según ingresos")}
              {modeBtn("custom", "A mano")}
            </div>
          </div>

          {uiMode === "custom" && (
            <div className="space-y-1.5">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{first(m.name)}</span>
                  <Input
                    inputMode="numeric"
                    className="h-8 w-20 text-right"
                    value={custom[m.userId] ?? ""}
                    onChange={(e) => setCustomPct(m.userId, e.target.value)}
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-2 text-sm">
            {shares.map((s) => (
              <div
                key={s.userId}
                className="flex justify-between py-0.5 tabular-nums"
              >
                <span className="text-muted-foreground">
                  {nameOf(s.userId)}
                  {s.userId === paidBy && (
                    <span className="ml-1 text-xs text-emerald-600">
                      (pagó)
                    </span>
                  )}
                  {uiMode === "proportional" && (
                    <span className="ml-1 text-xs">
                      ({pcts[s.userId]?.toFixed(0)}%)
                    </span>
                  )}
                </span>
                <span>{formatMoney(s.owedCents, currency)}</span>
              </div>
            ))}
            {paidBy && owesUser && (
              <p className="mt-1.5 border-t pt-1.5 text-xs">
                Pagó <b>{nameOf(paidBy)}</b> ·{" "}
                <b className="text-primary">
                  {nameOf(owesUser.userId)} le debe{" "}
                  {formatMoney(owesUser.owedCents, currency)}
                </b>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
