"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/** Lista de box-shadows (sin color: heredan `color` del elemento) para un campo de estrellas. */
function makeStars(count: number, area: number) {
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    parts.push(
      `${Math.floor(Math.random() * area)}px ${Math.floor(Math.random() * area)}px`,
    );
  }
  return parts.join(",");
}

export function CosmicBackground() {
  const [mounted, setMounted] = useState(false);
  const nearRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<HTMLDivElement>(null);

  const stars = useMemo(
    () => ({ far: makeStars(160, 2000), near: makeStars(46, 2000) }),
    [],
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;

    const apply = () => {
      raf = 0;
      if (farRef.current)
        farRef.current.style.transform = `translate3d(${tx * 0.25}px, ${ty * 0.25}px, 0)`;
      if (midRef.current)
        midRef.current.style.transform = `translate3d(${tx * 0.6}px, ${ty * 0.6}px, 0)`;
      if (nearRef.current)
        nearRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    };
    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 26;
      ty = (e.clientY / window.innerHeight - 0.5) * 26;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mounted]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Capa lejana — nebulosas difuminadas + estrellas tenues */}
      <div ref={farRef} className="absolute inset-0 will-change-transform">
        <div
          className="absolute -left-[15%] -top-[10%] h-[55vmax] w-[55vmax] rounded-full blur-[80px]"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, var(--neb-1), transparent 60%)",
            animation: "nebula-drift 90s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -right-[20%] top-[4%] h-[50vmax] w-[50vmax] rounded-full blur-[90px]"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, var(--neb-2), transparent 62%)",
            animation: "nebula-drift 120s ease-in-out infinite reverse",
          }}
        />
        <div
          className="absolute bottom-[-25%] left-[18%] h-[60vmax] w-[60vmax] rounded-full blur-[100px]"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, var(--neb-3), transparent 60%)",
            animation: "nebula-drift 140s ease-in-out infinite",
          }}
        />

        {mounted && (
          <div
            className="absolute left-0 top-0 h-[2px] w-[2px] rounded-full"
            style={{
              color: "var(--star-far-color)",
              opacity: "var(--star-far-opacity)",
              boxShadow: stars.far,
              animation: "starfield-pan 220s linear infinite",
            }}
          >
            <div
              className="absolute left-0 top-[2000px] h-[2px] w-[2px] rounded-full"
              style={{ color: "inherit", boxShadow: stars.far }}
            />
          </div>
        )}
      </div>

      {/* Capa intermedia — órbitas con objetos luminosos */}
      <div
        ref={midRef}
        className="absolute inset-0 will-change-transform"
        style={{ opacity: 0.55 }}
      >
        <div className="absolute right-[-10vmax] top-[45%] h-[42vmax] w-[42vmax] -translate-y-1/2">
          <div
            className="absolute inset-0 rounded-full border"
            style={{
              borderColor: "color-mix(in oklab, var(--cyan) 22%, transparent)",
              animation: "orbit-spin 160s linear infinite",
            }}
          >
            <div
              className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full"
              style={{
                background: "var(--glow)",
                boxShadow:
                  "0 0 16px 4px color-mix(in oklab, var(--glow) 55%, transparent)",
              }}
            />
          </div>
          <div
            className="absolute inset-[18%] rounded-full border"
            style={{
              borderColor: "color-mix(in oklab, #3a506b 35%, transparent)",
              animation: "orbit-spin 90s linear infinite reverse",
            }}
          >
            <div
              className="absolute top-1/2 -right-1 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
              style={{
                background: "var(--cyan)",
                boxShadow:
                  "0 0 12px 3px color-mix(in oklab, var(--cyan) 50%, transparent)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Capa cercana — puntos de luz flotando */}
      {mounted && (
        <div ref={nearRef} className="absolute inset-0 will-change-transform">
          <div
            className="absolute left-0 top-0 h-[2px] w-[2px] rounded-full"
            style={{
              color: "var(--glow)",
              opacity: "var(--star-near-opacity)",
              boxShadow: stars.near,
              animation:
                "starfield-pan 140s linear infinite, twinkle 7s ease-in-out infinite",
            }}
          >
            <div
              className="absolute left-0 top-[2000px] h-[2px] w-[2px] rounded-full"
              style={{ color: "inherit", boxShadow: stars.near }}
            />
          </div>
        </div>
      )}

      {/* Viñeta para mantener legible el contenido */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 40%, transparent 42%, var(--cosmic-vignette) 100%)",
        }}
      />
    </div>
  );
}
