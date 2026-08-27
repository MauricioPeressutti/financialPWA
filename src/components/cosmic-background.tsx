"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

export function CosmicBackground() {
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const farRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const filRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    type Star = {
      x: number;
      y: number;
      r: number;
      layer: number;
      a: number;
      ph: number;
      sp: number;
      hero: boolean;
    };

    let W = 0;
    let H = 0;
    let stars: Star[] = [];
    let starCol = "#c8d3ef";
    let heroCol = "#6fffe9";
    let baseOpacity = 0.8;

    const readTheme = () => {
      const c = getComputedStyle(document.documentElement);
      starCol = c.getPropertyValue("--star-far-color").trim() || starCol;
      heroCol = c.getPropertyValue("--glow").trim() || heroCol;
      const o = parseFloat(c.getPropertyValue("--star-far-opacity"));
      if (Number.isFinite(o)) baseOpacity = o;
    };

    const build = () => {
      const count = Math.min(520, Math.round((W * H) / 4600));
      stars = new Array(count);
      for (let i = 0; i < count; i++) {
        const layer =
          Math.random() < 0.66 ? 0 : Math.random() < 0.7 ? 1 : 2;
        stars[i] = {
          x: Math.random(),
          y: Math.random(),
          r:
            layer === 2
              ? 0.9 + Math.random() * 0.9
              : layer === 1
                ? 0.6 + Math.random() * 0.55
                : 0.35 + Math.random() * 0.45,
          layer,
          a: 0.32 + Math.random() * 0.55,
          ph: Math.random() * Math.PI * 2,
          sp: 0.12 + Math.random() * 0.45,
          hero: Math.random() < 0.045,
        };
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      readTheme();
      build();
    };

    // parallax objetivo (pointer) + suavizado
    let px = 0;
    let py = 0;
    let tpx = 0;
    let tpy = 0;
    const onMove = (e: PointerEvent) => {
      tpx = (e.clientX / window.innerWidth - 0.5) * 2;
      tpy = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    let raf = 0;
    const t0 = performance.now();

    const draw = (now: number) => {
      const t = (now - t0) / 1000;

      // easing hacia el objetivo + deriva automática lenta
      const k = reduce ? 1 : 0.03;
      px += (tpx - px) * k;
      py += (tpy - py) * k;
      const ax = reduce ? 0 : Math.sin(t * 0.05) * 0.22;
      const ay = reduce ? 0 : Math.cos(t * 0.043) * 0.18;
      const gx = (px + ax) * 0.6;
      const gy = (py + ay) * 0.6;

      // mueve las capas CSS con la misma señal (suave)
      if (farRef.current)
        farRef.current.style.transform = `translate3d(${gx * 8}px, ${gy * 8}px, 0)`;
      if (midRef.current)
        midRef.current.style.transform = `translate3d(${gx * 18}px, ${gy * 18}px, 0)`;
      if (filRef.current)
        filRef.current.style.transform = `translate3d(${gx * 13}px, ${gy * 13}px, 0) rotate(${
          reduce ? 0 : Math.sin(t * 0.02) * 2.4
        }deg) scale(1.06)`;

      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const depth = (s.layer + 1) / 3;
        let x = s.x * W + gx * depth * 22;
        let y = s.y * H + gy * depth * 22;
        x = ((x % W) + W) % W;
        y = ((y % H) + H) % H;

        const tw = reduce ? 1 : 0.6 + 0.4 * Math.sin(t * s.sp + s.ph);
        const alpha = Math.max(0, s.a * baseOpacity * tw);

        if (s.hero) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, s.r * 4.5);
          g.addColorStop(0, heroCol);
          g.addColorStop(1, "transparent");
          ctx.globalAlpha = alpha * 0.7;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, s.r * 4.5, 0, 6.283);
          ctx.fill();
          ctx.globalAlpha = Math.min(1, alpha + 0.25);
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(x, y, s.r * 0.9, 0, 6.283);
          ctx.fill();
        } else {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = starCol;
          ctx.beginPath();
          ctx.arc(x, y, s.r, 0, 6.283);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!reduce && !raf) {
        raf = requestAnimationFrame(loop);
      }
    };

    const themeObserver = new MutationObserver(() => {
      readTheme();
      if (reduce) draw(performance.now());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    if (reduce) {
      draw(performance.now());
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      themeObserver.disconnect();
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

      {/* Capa lejana: nebulosas difuminadas */}
      <div ref={farRef} className="absolute inset-0 will-change-transform">
        <div
          className="absolute inset-0"
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
        </div>
      </div>

      {/* Filamentos de gas */}
      <div
        ref={filRef}
        className="absolute inset-[-16%] will-change-transform"
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

      {/* Campo de estrellas: canvas (suave, anti-aliased, twinkle por estrella) */}
      {mounted && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ opacity: "var(--star-near-opacity, 0.9)" }}
        />
      )}

      {/* Estrellas fugaces */}
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
