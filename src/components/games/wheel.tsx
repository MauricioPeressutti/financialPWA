"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  colorFor,
  copyResult,
  Dot,
  prefersReduced,
  todayLabel,
  WinnerBanner,
  type Player,
} from "@/components/games/shared";

const SPINS = 7;
const RADIUS = 82;

export function WheelGame({
  players,
  onBack,
}: {
  players: Player[];
  onBack: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "spinning" | "result">("idle");
  const [winner, setWinner] = useState<number | null>(null);

  const wheelRef = useRef<HTMLDivElement>(null);
  const degRef = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const seg = 360 / players.length;
  const gradient = `conic-gradient(${players
    .map((p, i) => `${colorFor(p.id)} ${i * seg}deg ${(i + 1) * seg}deg`)
    .join(", ")})`;

  useEffect(() => {
    if (wheelRef.current) {
      wheelRef.current.style.transitionDuration = "0s";
      wheelRef.current.style.transform = `rotate(${degRef.current}deg)`;
    }
    return () => window.clearTimeout(timer.current);
  }, []);

  function spin() {
    const rm = prefersReduced();
    const w = Math.floor(Math.random() * players.length);
    const mid = w * seg + seg / 2;
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    let base = (-mid - jitter - (degRef.current % 360)) % 360;
    base = (base + 360) % 360;
    degRef.current += base + (rm ? 0 : SPINS * 360);

    const el = wheelRef.current;
    if (el) {
      el.style.transitionDuration = rm ? "1ms" : "3.6s";
      void el.offsetWidth;
      el.style.transform = `rotate(${degRef.current}deg)`;
    }

    setWinner(null);
    setPhase("spinning");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => {
        setWinner(w);
        setPhase("result");
        navigator.vibrate?.(40);
      },
      rm ? 10 : 3700,
    );
  }

  const winPlayer = winner != null ? players[winner] : null;
  const shareText = winPlayer
    ? `🎡 Le tocó a ${winPlayer.name} · ${todayLabel()}`
    : "";

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center">
        <div className="relative size-[220px]">
          <div className="qw-pointer" />
          <div
            ref={wheelRef}
            className="qw-wheel"
            style={{ background: gradient }}
          >
            <div className="qw-hub" />
            {players.map((p, i) => {
              const mid = i * seg + seg / 2;
              return (
                <div
                  key={p.id}
                  className={cn("qw-slot", winner === i && "qw-win")}
                  style={
                    {
                      transform: `rotate(${mid}deg) translateY(-${RADIUS}px)`,
                    } as CSSProperties
                  }
                >
                  <Dot p={p} />
                </div>
              );
            })}
          </div>
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

        {phase === "spinning" ? (
          <p className="py-1 text-center text-xs text-muted-foreground">
            Girando…
          </p>
        ) : (
          <div className="flex gap-2">
            <Button
              className="flex-1 border-0 bg-gradient-to-b from-[#f7e2a0] to-[#d9a441] text-[#3a2506] hover:brightness-105"
              onClick={spin}
            >
              {phase === "result" ? "Girar de nuevo" : "Girar"}
            </Button>
            {phase === "result" && (
              <Button variant="outline" className="flex-1" onClick={onBack}>
                Cambiar jugadores
              </Button>
            )}
          </div>
        )}
        {phase === "idle" && (
          <button
            type="button"
            className="w-full text-center text-xs text-muted-foreground"
            onClick={onBack}
          >
            ← cambiar jugadores
          </button>
        )}
      </div>
    </div>
  );
}
