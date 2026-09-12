import type { ComponentType } from "react";
import { Landmark, Wallet } from "lucide-react";

/**
 * Entidad bancaria / billetera con la que se hizo un movimiento. Texto libre:
 * Gemini escribe el nombre y acá lo canonicalizamos para las más comunes.
 * Lo desconocido se guarda title-cased tal cual.
 */

type IconComponent = ComponentType<{ className?: string }>;

function BrandImg(src: string, alt: string): IconComponent {
  function Brand({ className }: { className?: string }) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
      />
    );
  }
  Brand.displayName = `Brand(${alt})`;
  return Brand;
}

// nombre canónico -> { aliases, ícono, si es billetera/fintech }
const ENTITIES: Record<
  string,
  { aliases: string[]; Icon?: IconComponent; wallet?: boolean }
> = {
  "Banco Nación": { aliases: ["nacion", "bna", "banco nacion", "banco de la nacion"] },
  Galicia: { aliases: ["galicia", "banco galicia"] },
  Santander: { aliases: ["santander", "santander rio", "banco santander"] },
  BBVA: { aliases: ["bbva", "frances", "banco frances"] },
  "Banco Macro": { aliases: ["macro", "banco macro"] },
  ICBC: { aliases: ["icbc"] },
  "Banco Ciudad": { aliases: ["ciudad", "banco ciudad"] },
  "Banco Provincia": { aliases: ["provincia", "banco provincia", "bapro"] },
  Credicoop: { aliases: ["credicoop", "banco credicoop"] },
  Supervielle: { aliases: ["supervielle", "banco supervielle"] },
  "Banco Patagonia": { aliases: ["patagonia", "banco patagonia"] },
  Comafi: { aliases: ["comafi", "banco comafi"] },
  HSBC: { aliases: ["hsbc"] },
  "Banco Hipotecario": { aliases: ["hipotecario", "banco hipotecario"] },
  "Mercado Pago": {
    aliases: ["mercado pago", "mercadopago", "mp", "meli", "mercado libre"],
    Icon: BrandImg("/mercadopago.png", "Mercado Pago"),
    wallet: true,
  },
  MODO: {
    aliases: ["modo"],
    Icon: BrandImg("/modo.png", "MODO"),
    wallet: true,
  },
  "Ualá": { aliases: ["uala", "ualá"], wallet: true },
  Brubank: { aliases: ["brubank", "bru"], wallet: true },
  "Naranja X": { aliases: ["naranja x", "naranja", "naranjax", "nx"], wallet: true },
  "Personal Pay": { aliases: ["personal pay", "personalpay", "ppay"], wallet: true },
  "Cuenta DNI": { aliases: ["cuenta dni", "cuentadni"], wallet: true },
  Prex: { aliases: ["prex"], wallet: true },
  Belo: { aliases: ["belo"], wallet: true },
  Lemon: { aliases: ["lemon", "lemon cash"], wallet: true },
  Fiwind: { aliases: ["fiwind"], wallet: true },
  Reba: { aliases: ["reba"], wallet: true },
  "N1U": { aliases: ["n1u", "niu"], wallet: true },
  Astropay: { aliases: ["astropay"], wallet: true },
};

const ALIAS_TO_CANON: Record<string, string> = {};
for (const [canon, { aliases }] of Object.entries(ENTITIES)) {
  ALIAS_TO_CANON[norm(canon)] = canon;
  for (const a of aliases) ALIAS_TO_CANON[norm(a)] = canon;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\bbanco\b/g, "")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) =>
      w.length <= 3 && w === w.toUpperCase()
        ? w // siglas: BNA, HSBC
        : w[0]?.toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ");
}

/** Nombre canónico de una entidad a partir de lo que escribió Gemini / el usuario.
 *  null si viene vacío o es claramente no una entidad. */
export function normalizeEntity(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v || v.length > 40) return null;
  const key = norm(v);
  if (!key || key.length < 2) return null;
  if (ALIAS_TO_CANON[key]) return ALIAS_TO_CANON[key];
  // match parcial (ej: "tarjeta galicia visa")
  for (const [alias, canon] of Object.entries(ALIAS_TO_CANON)) {
    if (alias.length >= 4 && key.includes(alias)) return canon;
  }
  return titleCase(v).slice(0, 40);
}

/** Lista canónica para el datalist / autocompletado. */
export const KNOWN_ENTITIES = Object.keys(ENTITIES).sort((a, b) =>
  a.localeCompare(b, "es"),
);

function metaFor(name: string) {
  return ENTITIES[name];
}

/** Icono + nombre de una entidad. */
export function EntityTag({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const meta = metaFor(name);
  const Icon = meta?.Icon ?? (meta?.wallet ? Wallet : Landmark);
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <Icon className="size-4 shrink-0 rounded-[3px] text-muted-foreground" />
      {name}
    </span>
  );
}
