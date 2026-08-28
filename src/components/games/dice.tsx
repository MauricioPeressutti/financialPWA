"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  copyResult,
  prefersReduced,
  todayLabel,
  WinnerBanner,
  type Player,
} from "@/components/games/shared";

// orientacion (rotateX, rotateY) para que la cara V quede al frente
const DIE_ORI: Record<number, [number, number]> = {
  1: [0, 0],
  2: [0, -90],
  3: [0, 180],
  4: [0, 90],
  5: [-90, 0],
  6: [90, 0],
};
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function DieFaces() {
  return (
    <>
      {[1, 2, 3, 4, 5, 6].map((v) => (
        <div key={v} className={`qd-face qd-face--${v}`}>
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} className={PIPS[v].includes(i) ? "on" : ""} />
          ))}
        </div>
      ))}
    </>
  );
}

export function DiceGame({
  players,
  onBack,
}: {
  players: Player[];
  onBack: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "rolling" | "result">("idle");
  const [losers, setLosers] = useState<number[]>([]);
  const [resultMin, setResultMin] = useState(0);

  const dieRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rot = useRef(players.map(() => ({ x: 0, y: 0 })));
  const valsRef = useRef<number[]>(players.map(() => 1));
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function roll(indices: number[]) {
    const rm = prefersReduced();
    indices.forEach((i) => {
      const v = 1 + Math.floor(Math.random() * 6);
      valsRef.current[i] = v;
      const [bx, by] = DIE_ORI[v];
      const cur = rot.current[i];
      const turns = rm ? 0 : 3 + Math.floor(Math.random() * 2);
      cur.x = cur.x - (cur.x % 360) + bx + turns * 360;
      cur.y = cur.y - (cur.y % 360) + by + turns * 360;
      const el = dieRefs.current[i];
      if (el) {
        el.style.transitionDelay = `${rm ? 0 : i * 70}ms`;
        el.style.transform = `perspective(560px) rotateX(${cur.x}deg) rotateY(${cur.y}deg)`;
      }
    });

    setPhase("rolling");
    setLosers([]);
    window.clearTimeout(timer.current);
    // en un desempate solo compiten los que volvieron a tirar
    const pool =
      indices.length < players.length ? indices : players.map((_, i) => i);
    timer.current = window.setTimeout(
      () => {
        const v = valsRef.current;
        const min = Math.min(...pool.map((i) => v[i]));
        const ls = pool.filter((i) => v[i] === min);
        setResultMin(min);
        setLosers(ls);
        setPhase("result");
        if (ls.length === 1) navigator.vibrate?.([0, 30, 20, 40]);
      },
      rm ? 20 : 1300 + indices.length * 70,
    );
  }

  const tie = phase === "result" && losers.length > 1;
  const names = losers.map((i) => players[i].name).join(" y ");
  const shareText =
    phase === "result" && !tie
      ? `🎲 Le tocó a ${names} · ${todayLabel()}`
      : "";

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center">
        <div className="qd-tray">
          {players.map((p, i) => (
            <div
              key={p.id}
              className="qd-slot"
              data-win={phase === "result" && losers.includes(i)}
            >
              <div className="qd-cage">
                <div
                  ref={(el) => {
                    dieRefs.current[i] = el;
                  }}
                  className="qd-die"
                >
                  <DieFaces />
                </div>
              </div>
              <div className="qd-name">{p.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 space-y-3">
        {phase === "result" &&
          (tie ? (
            <div
              className={cn(
                "rounded-2xl border border-border bg-white/5 p-3 text-center",
              )}
            >
              <span className="text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
                Empate en {resultMin}
              </span>
              <b className="mt-0.5 block text-base font-bold">{names}</b>
            </div>
          ) : (
            <div className="text-center">
              <WinnerBanner verb="Invita" sub={`sacó ${resultMin}`} names={names} />
              <button
                type="button"
                className="mt-2.5 inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-1 text-xs text-primary"
                onClick={() => copyResult(shareText, toast)}
              >
                {shareText} · Copiar
              </button>
            </div>
          ))}

        {phase === "rolling" ? (
          <p className="py-1 text-center text-xs text-muted-foreground">
            Rodando…
          </p>
        ) : (
          <div className="flex gap-2">
            <Button
              className="flex-1 border-0 bg-gradient-to-b from-[#f7e2a0] to-[#d9a441] text-[#3a2506] hover:brightness-105"
              onClick={() =>
                roll(
                  tie ? losers : players.map((_, i) => i),
                )
              }
            >
              {phase === "idle"
                ? "Tirar"
                : tie
                  ? "Desempatar"
                  : "Tirar de nuevo"}
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
