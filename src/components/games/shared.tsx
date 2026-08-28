import { cn } from "@/lib/utils";

export type Player = { id: string; name: string };

const AV = ["#3987e5", "#d55181", "#199e70", "#c98500", "#9085e9", "#d95926"];

export const colorFor = (id: string) =>
  AV[
    Math.abs([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) %
      AV.length
  ];

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const prefersReduced = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const todayLabel = () =>
  new Date()
    .toLocaleDateString("es-AR", { day: "numeric", month: "short" })
    .replace(".", "");

export function copyResult(text: string, toast: {
  success: (m: string) => void;
  error: (m: string) => void;
}) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success("Copiado"),
    () => toast.error("No se pudo copiar"),
  );
}

export function Dot({
  p,
  size = "md",
}: {
  p: Player;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-bold text-white",
        size === "sm" && "size-[18px] text-[0.6rem]",
        size === "md" && "size-7 text-[0.68rem]",
        size === "lg" && "size-8 text-[0.8rem]",
      )}
      style={{ background: colorFor(p.id) }}
    >
      {p.name[0]?.toUpperCase()}
    </span>
  );
}

/** Barra de resultado verde: "Invita/Invitan  ·  <nombres>" */
export function WinnerBanner({
  verb,
  names,
  sub,
}: {
  verb: string;
  names: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-center">
      <span className="text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
        {verb}
        {sub ? ` · ${sub}` : ""}
      </span>
      <b className="mt-0.5 block text-lg font-bold text-emerald-500">{names}</b>
    </div>
  );
}
