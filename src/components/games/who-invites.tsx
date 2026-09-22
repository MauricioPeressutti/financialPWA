"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { CosmicBackground } from "@/components/cosmic-background";
import { cn } from "@/lib/utils";
import { CoinGame } from "@/components/games/coin";
import { DiceGame } from "@/components/games/dice";
import { FingerGame } from "@/components/games/finger";
import { WheelGame } from "@/components/games/wheel";
import { Dot, type Player } from "@/components/games/shared";
import { logGameRound } from "@/lib/actions/games";
import type { GameStats } from "@/lib/game-stats";

type GameId = "coin" | "wheel" | "finger" | "dice";

const GAMES: {
  id: GameId;
  icon: string;
  label: string;
  meta: string;
  needsEven?: boolean;
}[] = [
  { id: "coin", icon: "🪙", label: "Moneda", meta: "par · 2 equipos", needsEven: true },
  { id: "wheel", icon: "🎡", label: "Ruleta", meta: "2-6 · 1 elegido" },
  { id: "finger", icon: "👆", label: "El dedo", meta: "2+ · en la mesa" },
  { id: "dice", icon: "🎲", label: "Dados", meta: "2+ · el más bajo" },
];

const fits = (g: (typeof GAMES)[number], n: number) =>
  n >= 2 && (!g.needsEven || n % 2 === 0);

export function WhoInvites({
  players,
  stats,
}: {
  players: Player[];
  stats: GameStats;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(players.map((p) => p.id)),
  );
  const [view, setView] = useState<"select" | GameId>("select");

  const chosen = players.filter((p) => selected.has(p.id));

  function handleResult(game: GameId, payerIds: string[], playerIds: string[]) {
    startTransition(async () => {
      await logGameRound(game, playerIds, payerIds);
      router.refresh();
    });
  }

  const ranking = [...players]
    .map((p) => ({ p, s: stats[p.id] ?? { played: 0, paid: 0 } }))
    .filter((r) => r.s.played > 0)
    .sort((a, b) => b.s.paid - a.s.paid);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setView("select");
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const active = GAMES.find((g) => g.id === view);

  return (
    <>
      <section className="cosmic-panel rounded-2xl border p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#f7e2a0]/30 bg-gradient-to-br from-[#f7e2a0]/25 to-[#d9a441]/10 text-lg">
            🎲
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">¿Quién invita hoy?</p>
            <p className="text-xs text-muted-foreground">
              Elegí quién juega y qué juego.
            </p>
          </div>
        </div>
        <Button
          className="mt-3 w-full"
          onClick={() => {
            setView("select");
            setOpen(true);
          }}
        >
          Jugar
        </Button>
      </section>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.25rem+env(safe-area-inset-bottom))] duration-300 animate-in fade-in slide-in-from-bottom-8">
          <div aria-hidden className="absolute inset-0 -z-20 bg-background" />
          <CosmicBackground />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 30%, transparent 44%, var(--cosmic-vignette) 100%)",
            }}
          />

          <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col">
            <div className="mb-1 flex items-center justify-between">
              <b className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-primary">
                {active ? active.label : "Ronda de hoy"}
              </b>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={close}
                className="grid size-8 place-items-center rounded-lg border border-border bg-white/5 text-base leading-none"
              >
                ✕
              </button>
            </div>

            {view === "select" ? (
              <div className="flex flex-1 flex-col">
                <div className="flex flex-wrap justify-center gap-2">
                  {players.map((p) => {
                    const on = selected.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(p.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold transition-colors",
                          on
                            ? "border-primary bg-primary/15 text-foreground"
                            : "border-border text-muted-foreground opacity-60",
                        )}
                      >
                        <Dot p={p} size="sm" />
                        {p.name}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {GAMES.map((g) => {
                    const ok = fits(g, chosen.length);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        disabled={!ok}
                        onClick={() => setView(g.id)}
                        className={cn(
                          "rounded-2xl border border-border bg-white/[0.03] p-3 text-left transition-transform active:scale-[0.98]",
                          !ok && "opacity-40",
                        )}
                      >
                        <div className="text-2xl">{g.icon}</div>
                        <div className="mt-1.5 text-sm font-semibold">
                          {g.label}
                        </div>
                        <div className="text-[0.68rem] text-muted-foreground">
                          {g.meta}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <p className="mt-3 min-h-[1.1em] text-center text-xs text-muted-foreground">
                  {chosen.length < 2
                    ? "Elegí al menos 2 jugadores."
                    : chosen.length % 2 !== 0
                      ? "Con impar, la moneda queda deshabilitada."
                      : ""}
                </p>

                {ranking.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-border bg-white/[0.03] p-3">
                    <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Quién invitó más
                    </p>
                    <div className="space-y-1.5">
                      {ranking.map(({ p, s }) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 text-xs"
                        >
                          <Dot p={p} size="sm" />
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {p.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            invitó {s.paid}/{s.played} ·{" "}
                            {Math.round((s.paid / s.played) * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : view === "coin" ? (
              <CoinGame
                players={chosen}
                onBack={() => setView("select")}
                onResult={(payerIds, playerIds) =>
                  handleResult("coin", payerIds, playerIds)
                }
              />
            ) : view === "wheel" ? (
              <WheelGame
                players={chosen}
                onBack={() => setView("select")}
                onResult={(payerIds, playerIds) =>
                  handleResult("wheel", payerIds, playerIds)
                }
              />
            ) : view === "finger" ? (
              <FingerGame
                players={chosen}
                onBack={() => setView("select")}
                onResult={(payerIds, playerIds) =>
                  handleResult("finger", payerIds, playerIds)
                }
              />
            ) : (
              <DiceGame
                players={chosen}
                onBack={() => setView("select")}
                onResult={(payerIds, playerIds) =>
                  handleResult("dice", payerIds, playerIds)
                }
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
