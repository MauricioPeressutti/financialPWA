"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

/** box-shadows sin color (heredan `color`) para un campo de estrellas. */
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

  // preset "Deep Calm": nebulosa tenue, muchas estrellas
  const stars = useMemo(
    () => ({ far: makeStars(340, 2000), near: makeStars(80, 2000) }),
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
      // parallax 0.6x
      tx = (e.clientX / window.innerWidth - 0.5) * 16;
      ty = (e.clientY / window.innerHeight - 0.5) * 16;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mounted]);

  const shootingStars: CSSProperties[] = [
    {
      top: "7%",
      left: "80%",
      "--sf-angle": "167deg",
      "--sf-tx": "-140vw",
      "--sf-ty": "40vh",
      "--sf-cycle": "17s",
      "--sf-delay": "5s",
    } as CSSProperties,
    {
      top: "-3%",
      left: "58%",
      "--sf-angle": "174deg",
      "--sf-tx": "-120vw",
      "--sf-ty": "28vh",
      "--sf-cycle": "27s",
      "--sf-delay": "14s",
    } as CSSProperties,
    {
      top: "16%",
      left: "94%",
      "--sf-angle": "161deg",
      "--sf-tx": "-150vw",
      "--sf-ty": "52vh",
      "--sf-cycle": "22s",
      "--sf-delay": "34s",
    } as CSSProperties,
  ];

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <svg width="0" height="0" className="absolute">
        <filter id="cosmic-filaments" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.02"
            numOctaves="3"
            seed="11"
            stitchTiles="stitch"
            result="n"
          />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.5 -0.62"
            result="a"
          />
          <feComposite in="SourceGraphic" in2="a" operator="in" result="c" />
          <feGaussianBlur in="c" stdDeviation="6" />
        </filter>
      </svg>

      {/* Capa lejana: nebulosas difuminadas + filamentos + estrellas tenues */}
      <div
        ref={farRef}
        className="absolute inset-0 will-change-transform"
        style={{ filter: "hue-rotate(var(--neb-hue, 0deg))" }}
      >
        <div
          className="absolute -left-[15%] -top-[10%] h-[55vmax] w-[55vmax] rounded-full blur-[90px]"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, var(--neb-1), transparent 60%)",
            animation: "nebula-drift 200s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -right-[20%] top-[4%] h-[50vmax] w-[50vmax] rounded-full blur-[100px]"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, var(--neb-2), transparent 62%)",
            animation: "nebula-drift 260s ease-in-out infinite reverse",
          }}
        />
        <div
          className="absolute bottom-[-25%] left-[18%] h-[60vmax] w-[60vmax] rounded-full blur-[110px]"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, var(--neb-3), transparent 60%)",
            animation: "nebula-drift 320s ease-in-out infinite",
          }}
        />

        <div
          className="absolute inset-[-15%]"
          style={{
            opacity: 0.3,
            mixBlendMode: "screen",
            background:
              "linear-gradient(120deg, var(--neb-2) 0%, var(--neb-1) 50%, var(--neb-3) 100%)",
            WebkitMaskImage:
              "radial-gradient(70% 60% at 50% 45%, #000 0%, transparent 82%)",
            maskImage:
              "radial-gradient(70% 60% at 50% 45%, #000 0%, transparent 82%)",
            filter: "url(#cosmic-filaments)",
          }}
        />

        {mounted && (
          <div
            className="absolute left-0 top-0 h-[2px] w-[2px] rounded-full"
            style={{
              color: "var(--star-far-color)",
              opacity: "var(--star-far-opacity)",
              boxShadow: stars.far,
              animation: "starfield-pan 320s linear infinite",
            }}
          >
            <div
              className="absolute left-0 top-[2000px] h-[2px] w-[2px] rounded-full"
              style={{ color: "inherit", boxShadow: stars.far }}
            />
          </div>
        )}
      </div>

      {/* Capa intermedia: orbitas con objetos luminosos */}
      <div
        ref={midRef}
        className="absolute inset-0 will-change-transform"
        style={{ opacity: 0.4 }}
      >
        <div className="absolute right-[-10vmax] top-[45%] h-[42vmax] w-[42vmax] -translate-y-1/2">
          <div
            className="absolute inset-0 rounded-full border"
            style={{
              borderColor: "color-mix(in oklab, var(--cyan) 20%, transparent)",
              animation: "orbit-spin 260s linear infinite",
            }}
          >
            <div
              className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full"
              style={{
                background: "var(--glow)",
                boxShadow:
                  "0 0 16px 4px color-mix(in oklab, var(--glow) 50%, transparent)",
              }}
            />
          </div>
          <div
            className="absolute inset-[18%] rounded-full border"
            style={{
              borderColor: "color-mix(in oklab, #3a506b 32%, transparent)",
              animation: "orbit-spin 170s linear infinite reverse",
            }}
          >
            <div
              className="absolute top-1/2 -right-1 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
              style={{
                background: "var(--cyan)",
                boxShadow:
                  "0 0 12px 3px color-mix(in oklab, var(--cyan) 45%, transparent)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Capa cercana: puntos de luz flotando (parpadeo suave) */}
      {mounted && (
        <div ref={nearRef} className="absolute inset-0 will-change-transform">
          <div
            className="absolute left-0 top-0 h-[2px] w-[2px] rounded-full"
            style={{
              color: "var(--glow)",
              opacity: "var(--star-near-opacity)",
              boxShadow: stars.near,
              animation:
                "starfield-pan 220s linear infinite, twinkle 12s ease-in-out infinite",
            }}
          >
            <div
              className="absolute left-0 top-[2000px] h-[2px] w-[2px] rounded-full"
              style={{ color: "inherit", boxShadow: stars.near }}
            />
          </div>
        </div>
      )}

      {/* Estrellas fugaces: 3, con timings distintos para que pasen cada tanto */}
      {mounted &&
        shootingStars.map((s, i) => (
          <div key={i} className="shooting-star" style={s} />
        ))}

      {/* Grano fino: evita el banding de los degradados */}
      <div className="cosmic-grain absolute inset-0" />

      {/* Vineta para mantener legible el contenido */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 40%, transparent 44%, var(--cosmic-vignette) 100%)",
        }}
      />
    </div>
  );
}
