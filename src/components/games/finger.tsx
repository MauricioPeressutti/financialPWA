"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  colorFor,
  copyResult,
  prefersReduced,
  todayLabel,
  WinnerBanner,
  type Player,
} from "@/components/games/shared";

type Finger = { p: Player; x: number; y: number };
type Phase = "placing" | "counting" | "result";

export function FingerGame({
  players,
  onBack,
}: {
  players: Player[];
  onBack: () => void;
}) {
  const [fingers, setFingers] = useState<Finger[]>([]);
  const [phase, setPhase] = useState<Phase>("placing");
  const [winner, setWinner] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function place(e: React.PointerEvent<HTMLDivElement>) {
    if (phase !== "placing" || fingers.length >= players.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    const p = players[fingers.length];
    setFingers((f) => [
      ...f,
      { p, x: e.clientX - r.left, y: e.clientY - r.top },
    ]);
  }

  function draw() {
    if (fingers.length < 2) return;
    const rm = prefersReduced();
    setPhase("counting");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => {
        setWinner(Math.floor(Math.random() * fingers.length));
        setPhase("result");
        navigator.vibrate?.([0, 30, 20, 40]);
      },
      rm ? 10 : 2400,
    );
  }

  function reset() {
    window.clearTimeout(timer.current);
    setFingers([]);
    setWinner(null);
    setPhase("placing");
  }

  const winPlayer = winner != null ? fingers[winner].p : null;
  const shareText = winPlayer
    ? `👆 Le tocó a ${winPlayer.name} · ${todayLabel()}`
    : "";

  const state = (i: number) => {
    if (phase === "result") return winner === i ? "win" : "out";
    if (phase === "counting") return "count";
    return "pulse";
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col py-2">
        <div
          className="qf-pad flex-1"
          onPointerDown={place}
          role="presentation"
        >
          {fingers.length === 0 && (
            <div className="qf-hint">
              Tocá para poner un dedo por jugador
              <br />
              <span className="text-[0.7rem] opacity-70">
                (en la mesa, cada uno toca su lugar)
              </span>
            </div>
          )}
          {fingers.map((f, i) => {
            const st = state(i);
            return (
              <div
                key={i}
                className="qf-finger"
                data-state={st === "count" ? "pulse" : st}
                data-count={st === "count"}
                style={
                  {
                    left: `${f.x}px`,
                    top: `${f.y}px`,
                    "--c": colorFor(f.p.id),
                  } as CSSProperties
                }
              >
                <svg className="qf-ring" viewBox="0 0 68 68">
                  <circle cx="34" cy="34" r="33" />
                </svg>
                <span
                  className="grid size-8 place-items-center rounded-full text-[0.75rem] font-bold text-white"
                  style={{ background: colorFor(f.p.id) }}
                >
                  {f.p.name[0]?.toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 space-y-3">
        {phase === "result" && winPlayer && (
          <div className="text-center">
            <WinnerBanner verb="Invita" names={winPlayer.name} />
            <button
              type="button"
              className="mt-2.5 inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-1 text-xs text-primary"
              onClick={() => copyResult(shareText, toast)}
            >
              {shareText} · Copiar
            </button>
          </div>
        )}

        {phase === "placing" && (
          <>
            <Button
              className="w-full border-0 bg-gradient-to-b from-[#f7e2a0] to-[#d9a441] text-[#3a2506] hover:brightness-105"
              disabled={fingers.length < 2}
              onClick={draw}
            >
              {fingers.length < 2
                ? `Poné al menos 2 (${fingers.length}/${players.length})`
                : `Sortear (${fingers.length}/${players.length})`}
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground"
              onClick={onBack}
            >
              ← cambiar jugadores
            </button>
          </>
        )}

        {phase === "counting" && (
          <p className="py-1 text-center text-xs text-muted-foreground">
            No saquen el dedo…
          </p>
        )}

        {phase === "result" && (
          <div className="flex gap-2">
            <Button
              className="flex-1 border-0 bg-gradient-to-b from-[#f7e2a0] to-[#d9a441] text-[#3a2506] hover:brightness-105"
              onClick={reset}
            >
              De nuevo
            </Button>
            <Button variant="outline" className="flex-1" onClick={onBack}>
              Cambiar jugadores
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
