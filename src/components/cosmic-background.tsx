"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

export function CosmicBackground() {
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      depth: number;
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
    let glow: HTMLCanvasElement | null = null;

    const readTheme = () => {
      const c = getComputedStyle(document.documentElement);
      starCol = c.getPropertyValue("--star-far-color").trim() || starCol;
      heroCol = c.getPropertyValue("--glow").trim() || heroCol;
      const o = parseFloat(c.getPropertyValue("--star-far-opacity"));
      if (Number.isFinite(o)) baseOpacity = o;
      // sprite de brillo pre-renderizado (una vez por tema)
      const g = document.createElement("canvas");
      g.width = g.height = 40;
      const gc = g.getContext("2d")!;
      const rad = gc.createRadialGradient(20, 20, 0, 20, 20, 20);
      rad.addColorStop(0, heroCol);
      rad.addColorStop(1, "transparent");
      gc.fillStyle = rad;
      gc.fillRect(0, 0, 40, 40);
      glow = g;
    };

    const build = () => {
      const count = Math.min(280, Math.round((W * H) / 9000));
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
          depth: (layer + 1) / 3,
          a: 0.32 + Math.random() * 0.55,
          ph: Math.random() * Math.PI * 2,
          sp: 0.1 + Math.random() * 0.4,
          hero: Math.random() < 0.04,
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

    // parallax sutil (solo canvas), suavizado
    let px = 0;
    let py = 0;
    let tpx = 0;
    let tpy = 0;
    const onMove = (e: PointerEvent) => {
      tpx = (e.clientX / window.innerWidth - 0.5) * 2;
      tpy = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    let raf = 0;
    let lastDraw = 0;
    const t0 = performance.now();

    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      px += (tpx - px) * (reduce ? 1 : 0.04);
      py += (tpy - py) * (reduce ? 1 : 0.04);
      const gx = px * 14;
      const gy = py * 14;

      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        let x = s.x * W + gx * s.depth;
        let y = s.y * H + gy * s.depth;
        x = ((x % W) + W) % W;
        y = ((y % H) + H) % H;

        const tw = reduce ? 1 : 0.62 + 0.38 * Math.sin(t * s.sp + s.ph);
        const alpha = Math.max(0, s.a * baseOpacity * tw);

        if (s.hero && glow) {
          ctx.globalAlpha = alpha * 0.6;
          ctx.drawImage(glow, x - s.r * 5, y - s.r * 5, s.r * 10, s.r * 10);
          ctx.globalAlpha = Math.min(1, alpha + 0.2);
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
      // ~30fps: alcanza de sobra para el titileo del fondo
      if (now - lastDraw >= 33) {
        lastDraw = now;
        draw(now);
      }
      raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!reduce && !raf) {
        lastDraw = 0;
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
    if (!reduce)
      window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    if (reduce) draw(performance.now());
    else raf = requestAnimationFrame(loop);

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
      {/* Nebulosas: gradientes radiales suaves, sin blur() (el falloff del
          gradiente ya difumina; blur(100px) sobre 60vmax es carísimo). */}
      <div className="absolute inset-0">

        <div
          className="absolute -left-[25%] -top-[25%] h-[85vmax] w-[85vmax]"
          style={{
            background:
              "radial-gradient(circle at 40% 40%, var(--neb-1) 0%, transparent 55%)",
          }}
        />
        <div
          className="absolute -right-[30%] -top-[20%] h-[80vmax] w-[80vmax]"
          style={{
            background:
              "radial-gradient(circle at 55% 45%, var(--neb-2) 0%, transparent 55%)",
          }}
        />
        <div
          className="absolute bottom-[-45%] left-[5%] h-[95vmax] w-[95vmax]"
          style={{
            background:
              "radial-gradient(circle at 50% 45%, var(--neb-3) 0%, transparent 55%)",
          }}
        />
      </div>

      {/* Orbitas decorativas (rotacion CSS, sin filtros) */}
      <div className="absolute inset-0" style={{ opacity: 0.32 }}>
        <div className="absolute right-[-12vmax] top-[45%] h-[40vmax] w-[40vmax] -translate-y-1/2">
          <div
            className="absolute inset-0 rounded-full border will-change-transform"
            style={{
              borderColor: "color-mix(in oklab, var(--cyan) 18%, transparent)",
              animation: "orbit-spin 280s linear infinite",
            }}
          >
            <div
              className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
              style={{
                background: "var(--glow)",
                boxShadow:
                  "0 0 12px 3px color-mix(in oklab, var(--glow) 45%, transparent)",
              }}
            />
          </div>
          <div
            className="absolute inset-[22%] rounded-full border"
            style={{
              borderColor: "color-mix(in oklab, #3a506b 28%, transparent)",
            }}
          />
        </div>
      </div>

      {/* Campo de estrellas: canvas a 30fps */}
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

      {/* Grano fino */}
      <div className="cosmic-grain absolute inset-0" />

      {/* Vineta */}
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
