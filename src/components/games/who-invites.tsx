"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Player = { id: string; name: string };

const AVATAR_BG = [
  "#3987e5",
  "#d55181",
  "#199e70",
  "#c98500",
  "#9085e9",
  "#d95926",
];
const avatarColor = (id: string) =>
  AVATAR_BG[
    Math.abs([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) %
      AVATAR_BG.length
  ];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Result = { side: "cara" | "cruz"; cara: Player[]; cruz: Player[] };

const reduceMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function WhoInvites({ players }: { players: Player[] }) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(players.map((p) => p.id)),
  );
  const [phase, setPhase] = useState<"setup" | "flipping" | "result">("setup");
  const [result, setResult] = useState<Result | null>(null);

  const chosen = players.filter((p) => selected.has(p.id));
  const even = chosen.length >= 2 && chosen.length % 2 === 0;

  function reset() {
    setPhase("setup");
    setResult(null);
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    reset();
  }

  function flip() {
    if (!even) return;
    const mixed = shuffle(chosen);
    const half = mixed.length / 2;
    const side: "cara" | "cruz" = Math.random() < 0.5 ? "cara" : "cruz";
    setResult({ side, cara: mixed.slice(0, half), cruz: mixed.slice(half) });
    setPhase("flipping");
    window.setTimeout(() => setPhase("result"), reduceMotion() ? 0 : 1400);
  }

  const winners =
    result && (result.side === "cara" ? result.cara : result.cruz);

  return (
    <section className="cosmic-panel rounded-2xl border p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          🪙
        </span>
        <div>
          <p className="text-sm font-semibold">¿Quién invita hoy?</p>
          <p className="text-xs text-muted-foreground">
            Elegí quién juega y tirá la moneda.
          </p>
        </div>
      </div>

      {phase === "result" && result ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col items-center">
            <Coin side={result.side} />
            <p className="mt-2 text-lg font-bold uppercase tracking-wide">
              {result.side}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
            <p className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">
              {winners && winners.length > 1 ? "Invitan" : "Invita"}
            </p>
            <p className="mt-0.5 text-base font-bold text-emerald-600">
              {winners?.map((p) => p.name).join(" y ")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <TeamList
              label="Cara"
              players={result.cara}
              win={result.side === "cara"}
            />
            <TeamList
              label="Cruz"
              players={result.cruz}
              win={result.side === "cruz"}
            />
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={flip}>
              Tirar de nuevo
            </Button>
            <Button variant="outline" className="flex-1" onClick={reset}>
              Cambiar jugadores
            </Button>
          </div>
        </div>
      ) : phase === "flipping" ? (
        <div className="mt-6 flex flex-col items-center gap-2 py-4">
          <Coin flipping />
          <p className="text-xs text-muted-foreground">Girando…</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {players.map((p) => {
              const on = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-medium transition-colors",
                    on
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border text-muted-foreground opacity-60",
                  )}
                >
                  <span
                    className="grid size-5 place-items-center rounded-full text-[0.6rem] font-bold text-white"
                    style={{ background: avatarColor(p.id) }}
                  >
                    {p.name[0]?.toUpperCase()}
                  </span>
                  {p.name}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary bg-primary/15 px-2.5 py-1 text-xs font-semibold">
              🪙 Moneda
            </span>
            <span className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground">
              más juegos pronto
            </span>
          </div>

          {!even && (
            <p className="text-xs text-muted-foreground">
              {chosen.length < 2
                ? "Elegí al menos 2 jugadores."
                : "La moneda necesita un número par de jugadores (se arman 2 equipos)."}
            </p>
          )}

          <Button className="w-full" disabled={!even} onClick={flip}>
            Tirar la moneda
          </Button>
        </div>
      )}
    </section>
  );
}

function Coin({
  side,
  flipping,
}: {
  side?: "cara" | "cruz";
  flipping?: boolean;
}) {
  return (
    <span
      className={cn(
        "grid size-16 place-items-center rounded-full bg-gradient-to-br from-[#f4d47c] to-[#c98500] text-xl font-bold text-[#5a3a00] shadow-lg ring-2 ring-[#f4d47c]/60",
        flipping && "motion-safe:animate-spin",
      )}
      aria-hidden
    >
      {flipping ? "🪙" : side === "cara" ? "C" : "×"}
    </span>
  );
}

function TeamList({
  label,
  players,
  win,
}: {
  label: string;
  players: Player[];
  win: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-2.5",
        win ? "border-emerald-500/40 bg-emerald-500/5" : "opacity-70",
      )}
    >
      <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <ul className="space-y-0.5">
        {players.map((p) => (
          <li key={p.id} className="truncate">
            {p.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
