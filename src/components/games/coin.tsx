"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  copyResult,
  Dot,
  prefersReduced,
  shuffle,
  todayLabel,
  type Player,
} from "@/components/games/shared";

const SPINS = 9;
const DUR = 3; // segundos
const SPARK_COLORS = ["#6fffe9", "#5bc0be", "#f7e2a0", "#3ddc97"];

type Result = { side: "cara" | "cruz"; cara: Player[]; cruz: Player[] };
type Spark = { id: number; dx: number; dy: number; c: string };

const PLANET = (
  <svg className="qi-emblem" viewBox="0 0 64 64" aria-hidden="true">
    <circle className="qi-emblem-dot" cx="32" cy="31" r="13" />
    <ellipse
      cx="32"
      cy="31"
      rx="27"
      ry="8.5"
      fill="none"
      strokeWidth="4"
      transform="rotate(-20 32 31)"
    />
  </svg>
);
const STAR = (
  <svg className="qi-emblem" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M32 3 L37.5 24.5 L59 30 L37.5 35.5 L32 57 L26.5 35.5 L5 30 L26.5 24.5 Z" />
    <circle className="qi-emblem-dot" cx="32" cy="30" r="4.5" />
  </svg>
);

function Team({
  label,
  players,
  state,
}: {
  label: string;
  players: Player[];
  state: "hidden" | "neutral" | "win" | "lose";
}) {
  return (
    <div
      className={cn(
        "self-center rounded-xl border border-transparent p-2.5 transition-all duration-300",
        state === "hidden" && "opacity-0",
        state === "win" &&
          "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_30px_-6px_rgba(61,220,151,0.4)]",
        state === "lose" && "opacity-30 grayscale",
      )}
    >
      <span
        className={cn(
          "mb-2 block text-center text-[0.6rem] font-bold uppercase tracking-[0.16em]",
          state === "win" ? "text-emerald-500" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <div className="flex flex-col items-center gap-1.5">
        {players.map((p) => (
          <span
            key={p.id}
            className="flex max-w-full items-center gap-1.5 rounded-full border bg-white/5 py-0.5 pl-0.5 pr-2 text-[0.72rem]"
          >
            <Dot p={p} size="sm" />
            <b className="truncate font-medium">{p.name}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export function CoinGame({
  players,
  onBack,
}: {
  players: Player[];
  onBack: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "flipping" | "result">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [shake, setShake] = useState(false);

  const coinRef = useRef<HTMLDivElement>(null);
  const degRef = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (coinRef.current) {
      coinRef.current.style.transitionDuration = "0s";
      coinRef.current.style.transform = `rotateX(${degRef.current}deg)`;
    }
    return () => window.clearTimeout(timer.current);
  }, []);

  function land() {
    setPhase("result");
    if (!prefersReduced()) {
      setSparks(
        Array.from({ length: 18 }, (_, i) => {
          const ang = Math.random() * Math.PI * 2;
          const dist = 40 + Math.random() * 70;
          return {
            id: i,
            dx: Math.cos(ang) * dist,
            dy: Math.sin(ang) * dist,
            c: SPARK_COLORS[i % SPARK_COLORS.length],
          };
        }),
      );
      window.setTimeout(() => setSparks([]), 760);
      setShake(true);
      window.setTimeout(() => setShake(false), 440);
    }
    navigator.vibrate?.([0, 35, 25, 50]);
  }

  function flip() {
    const rm = prefersReduced();
    const mixed = shuffle(players);
    const half = mixed.length / 2;
    const side: "cara" | "cruz" = Math.random() < 0.5 ? "cara" : "cruz";
    const r: Result = {
      side,
      cara: mixed.slice(0, half),
      cruz: mixed.slice(half),
    };
    setResult(r);
    setPhase("flipping");
    setSparks([]);

    const offset = side === "cruz" ? 180 : 0;
    const delta = SPINS * 360 + (((offset - (degRef.current % 360)) + 360) % 360);
    degRef.current += delta;

    const el = coinRef.current;
    if (el) {
      el.style.transitionDuration = rm ? "1ms" : `${DUR}s`;
      void el.offsetWidth;
      el.style.transform = `rotateX(${degRef.current}deg)`;
    }

    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(land, (rm ? 1 : DUR * 1000) + 40);
  }

  const teamState = (
    side: "cara" | "cruz",
  ): Parameters<typeof Team>[0]["state"] => {
    if (phase !== "result" || !result) return "neutral";
    return result.side === side ? "win" : "lose";
  };

  const winners = result
    ? result.side === "cara"
      ? result.cara
      : result.cruz
    : [];
  const names = winners.map((p) => p.name).join(" y ");
  const shareText = `🪙 Le tocó a ${names} · ${todayLabel()}`;

  return (
    <div className={cn("flex flex-1 flex-col", shake && "g-shake")}>
      <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-1.5">
        <Team label="Cara" players={result?.cara ?? []} state={teamState("cara")} />

        <div
          className="qi-stage"
          data-flipping={phase === "flipping"}
          style={{ "--qi-dur": `${DUR}s` } as CSSProperties}
        >
          <div className="qi-orbit" data-hide={phase !== "idle"}>
            {players.map((p, i) => (
              <span
                key={p.id}
                className="qi-orbit-slot"
                style={
                  { "--o": `${(i * 360) / players.length}deg` } as CSSProperties
                }
              >
                <Dot p={p} />
              </span>
            ))}
          </div>

          <div className="qi-coin-wrap">
            <div ref={coinRef} className="qi-coin">
              <div className="qi-face qi-face--a">{PLANET}</div>
              <div className="qi-face qi-face--b">{STAR}</div>
              {Array.from({ length: 20 }, (_, i) => (
                <span
                  key={i}
                  className="qi-edge"
                  style={{ "--a": `${i * 18}deg` } as CSSProperties}
                />
              ))}
            </div>
          </div>

          <div className="qi-shadow" />

          {phase === "result" && result && (
            <span className="absolute top-1 text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--glow)]">
              {result.side}
            </span>
          )}

          {sparks.map((s) => (
            <span
              key={s.id}
              className="qi-spark"
              style={
                {
                  "--dx": `${s.dx}px`,
                  "--dy": `${s.dy}px`,
                  "--c": s.c,
                } as CSSProperties
              }
            />
          ))}
        </div>

        <Team label="Cruz" players={result?.cruz ?? []} state={teamState("cruz")} />
      </div>

      <div className="shrink-0">
        {phase === "idle" && (
          <Button
            className="w-full border-0 bg-gradient-to-b from-[#f7e2a0] to-[#d9a441] text-[#3a2506] hover:brightness-105"
            onClick={flip}
          >
            Tirar la moneda
          </Button>
        )}
        {phase === "flipping" && (
          <p className="py-1 text-center text-xs text-muted-foreground">Girando…</p>
        )}
        {phase === "result" && result && (
          <div className="text-center">
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3">
              <span className="text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
                {winners.length > 1 ? "Invitan" : "Invita"}
              </span>
              <b className="mt-0.5 block text-lg font-bold text-emerald-500">
                {names}
              </b>
            </div>
            <button
              type="button"
              className="mt-2.5 inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-1 text-xs text-primary"
              onClick={() => copyResult(shareText, toast)}
            >
              {shareText} · Copiar
            </button>
            <div className="mt-3.5 flex gap-2">
              <Button
                className="flex-1 border-0 bg-gradient-to-b from-[#f7e2a0] to-[#d9a441] text-[#3a2506] hover:brightness-105"
                onClick={flip}
              >
                Tirar de nuevo
              </Button>
              <Button variant="outline" className="flex-1" onClick={onBack}>
                Cambiar jugadores
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
