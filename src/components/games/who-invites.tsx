"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Player = { id: string; name: string };

const AV = ["#3987e5", "#d55181", "#199e70", "#c98500", "#9085e9", "#d95926"];
const colorFor = (id: string) =>
  AV[
    Math.abs([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) %
      AV.length
  ];

const SPINS = 9;
const DUR = 3; // segundos
const SPARK_COLORS = ["#6fffe9", "#5bc0be", "#f7e2a0", "#3ddc97"];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const prefersReduced = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

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

function Dot({ p, sm }: { p: Player; sm?: boolean }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-bold text-white",
        sm ? "size-[18px] text-[0.6rem]" : "size-7 text-[0.68rem]",
      )}
      style={{ background: colorFor(p.id) }}
    >
      {p.name[0]?.toUpperCase()}
    </span>
  );
}

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
            <Dot p={p} sm />
            <b className="truncate font-medium">{p.name}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export function WhoInvites({ players }: { players: Player[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(players.map((p) => p.id)),
  );
  const [phase, setPhase] = useState<"select" | "flipping" | "result">("select");
  const [result, setResult] = useState<Result | null>(null);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [shake, setShake] = useState(false);

  const coinRef = useRef<HTMLDivElement>(null);
  const degRef = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const chosen = players.filter((p) => selected.has(p.id));
  const even = chosen.length >= 2 && chosen.length % 2 === 0;

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    if (coinRef.current) {
      coinRef.current.style.transitionDuration = "0s";
      coinRef.current.style.transform = `rotateX(${degRef.current}deg)`;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    window.clearTimeout(timer.current);
    degRef.current = 0;
    setOpen(false);
    setPhase("select");
    setResult(null);
    setSparks([]);
    setShake(false);
  }

  function toSelect() {
    window.clearTimeout(timer.current);
    setPhase("select");
    setResult(null);
    setSparks([]);
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    if (phase !== "select") toSelect();
  }

  function land(r: Result) {
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
    if (!even) return;
    const rm = prefersReduced();
    const mixed = shuffle(chosen);
    const half = mixed.length / 2;
    const side: "cara" | "cruz" = Math.random() < 0.5 ? "cara" : "cruz";
    const r: Result = {
      side,
      cara: mixed.slice(0, half),
      cruz: mixed.slice(half),
    };
    setResult(r);
    setPhase("flipping");

    const offset = side === "cruz" ? 180 : 0;
    const delta =
      SPINS * 360 + (((offset - (degRef.current % 360)) + 360) % 360);
    degRef.current += delta;

    const el = coinRef.current;
    if (el) {
      el.style.transitionDuration = rm ? "1ms" : `${DUR}s`;
      void el.offsetWidth; // reflow para que arranque la transición
      el.style.transform = `rotateX(${degRef.current}deg)`;
    }

    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => land(r),
      (rm ? 1 : DUR * 1000) + 40,
    );
  }

  const teamState = (side: "cara" | "cruz"): Parameters<typeof Team>[0]["state"] => {
    if (phase === "select") return "hidden";
    if (phase !== "result" || !result) return "neutral";
    return result.side === side ? "win" : "lose";
  };

  let panel: ReactNode = null;
  if (phase === "select") {
    const hint =
      chosen.length < 2
        ? "Elegí al menos 2 jugadores."
        : !even
          ? "La moneda necesita número par (se arman 2 equipos)."
          : "";
    panel = (
      <>
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
                <Dot p={p} sm />
                {p.name}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex justify-center gap-2">
          <span className="rounded-full border border-primary bg-primary/15 px-2.5 py-1 text-xs font-semibold">
            🪙 Moneda
          </span>
          <span className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground">
            más juegos pronto
          </span>
        </div>
        <p className="mt-3 min-h-[1.1em] text-center text-xs text-muted-foreground">
          {hint}
        </p>
        <Button
          className="mt-3 w-full border-0 bg-gradient-to-b from-[#f7e2a0] to-[#d9a441] text-[#3a2506] hover:brightness-105"
          disabled={!even}
          onClick={flip}
        >
          Tirar la moneda
        </Button>
      </>
    );
  } else if (phase === "flipping") {
    panel = (
      <p className="py-1 text-center text-xs text-muted-foreground">Girando…</p>
    );
  } else if (result) {
    const winners = result.side === "cara" ? result.cara : result.cruz;
    const names = winners.map((p) => p.name).join(" y ");
    const verb = winners.length > 1 ? "Invitan" : "Invita";
    const today = new Date()
      .toLocaleDateString("es-AR", { day: "numeric", month: "short" })
      .replace(".", "");
    const shareText = `🪙 Le tocó a ${names} · ${today}`;
    panel = (
      <div className="text-center">
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3">
          <span className="text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
            {verb}
          </span>
          <b className="mt-0.5 block text-lg font-bold text-emerald-500">
            {names}
          </b>
        </div>
        <button
          type="button"
          className="mt-2.5 inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-1 text-xs text-primary"
          onClick={() => {
            navigator.clipboard?.writeText(shareText).then(
              () => toast.success("Copiado"),
              () => toast.error("No se pudo copiar"),
            );
          }}
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
          <Button variant="outline" className="flex-1" onClick={toSelect}>
            Cambiar jugadores
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="cosmic-panel rounded-2xl border p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#f7e2a0]/30 bg-gradient-to-br from-[#f7e2a0]/25 to-[#d9a441]/10 text-lg">
            🪙
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">¿Quién invita hoy?</p>
            <p className="text-xs text-muted-foreground">
              Elegí quién juega y que decida la suerte.
            </p>
          </div>
        </div>
        <Button
          className="mt-3 w-full"
          onClick={() => {
            toSelect();
            setOpen(true);
          }}
        >
          Jugar
        </Button>
      </section>

      {open && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex flex-col bg-background p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.25rem+env(safe-area-inset-bottom))] duration-300 animate-in fade-in slide-in-from-bottom-8",
            shake && "qi-shake",
          )}
        >
          {/* misma vineta cosmica que usa el fondo de la app */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 30%, transparent 44%, var(--cosmic-vignette) 100%)",
            }}
          />
          <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col">
            <div className="flex items-center justify-between">
              <b className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-primary">
                {phase === "result" ? "Resultado" : "Ronda de hoy"}
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

            <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-1.5">
              <Team
                label="Cara"
                players={result?.cara ?? []}
                state={teamState("cara")}
              />

              <div
                className="qi-stage"
                data-flipping={phase === "flipping"}
                style={{ "--qi-dur": `${DUR}s` } as CSSProperties}
              >
                <div className="qi-orbit" data-hide={phase !== "select"}>
                  {chosen.map((p, i) => (
                    <span
                      key={p.id}
                      className="qi-orbit-slot"
                      style={
                        { "--o": `${(i * 360) / chosen.length}deg` } as CSSProperties
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

              <Team
                label="Cruz"
                players={result?.cruz ?? []}
                state={teamState("cruz")}
              />
            </div>

            <div className="shrink-0">{panel}</div>
          </div>
        </div>
      )}
    </>
  );
}
