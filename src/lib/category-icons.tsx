"use client";

import { useState } from "react";
import {
  Beer,
  Bike,
  Bus,
  Car,
  Coffee,
  Cross,
  Dumbbell,
  Fuel,
  Gift,
  HandCoins,
  Home,
  KeyRound,
  Laptop,
  Package,
  PartyPopper,
  Percent,
  Pill,
  PiggyBank,
  Plane,
  Scissors,
  ShieldCheck,
  Shirt,
  ShoppingCart,
  Sofa,
  Sparkles,
  Stethoscope,
  Store,
  Tv,
  Undo2,
  Utensils,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ICONS = {
  cart: ShoppingCart,
  utensils: Utensils,
  coffee: Coffee,
  beer: Beer,
  sparkles: Sparkles,
  key: KeyRound,
  sofa: Sofa,
  zap: Zap,
  home: Home,
  fuel: Fuel,
  bus: Bus,
  car: Car,
  wrench: Wrench,
  bike: Bike,
  rappi: Bike,
  pedidosya: Bike,
  ubereats: Bike,
  pill: Pill,
  cross: Cross,
  health: Stethoscope,
  store: Store,
  tv: Tv,
  plane: Plane,
  fun: PartyPopper,
  wallet: Wallet,
  coins: HandCoins,
  laptop: Laptop,
  gift: Gift,
  undo: Undo2,
  percent: Percent,
  piggy: PiggyBank,
  package: Package,
  dumbbell: Dumbbell,
  shirt: Shirt,
  scissors: Scissors,
  shield: ShieldCheck,
} as const;

type IconId = keyof typeof ICONS;

// Logos de marca en /public. Si el archivo no existe, cae al icono de lucide.
const BRAND_SRC: Partial<Record<IconId, string>> = {
  rappi: "/rappi.png",
  pedidosya: "/pedidosya.png",
  ubereats: "/ubereats.png",
};

const norm = (s: string) =>
  ` ${s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")} `;

// [palabras clave, icono] — se evalúa en orden, gana la primera que matchea
// (las marcas de delivery antes de "uber" = taxi).
const RULES: [string[], IconId][] = [
  [["rappi"], "rappi"],
  [["pedidosya", "pedidos ya"], "pedidosya"],
  [["uber eats", "ubereats"], "ubereats"],
  [["delivery", "pedido"], "bike"],
  [["supermercado", "super", "almacen", "verduleria", "carniceria", "chino"], "cart"],
  [["comida", "almuerzo", "cena", "resto", "restaurant", "vianda"], "utensils"],
  [["cafe", "starbucks", "havanna"], "coffee"],
  [["bebida", "cerveza", "birra", "vino", "bar", "boliche", "salida", "trago", "after"], "beer"],
  [["limpieza"], "sparkles"],
  [["alquiler", "renta"], "key"],
  [["mueble", "sillon", "sofa", "deco", "colchon"], "sofa"],
  [["seguro", "poliza", "aseguradora"], "shield"],
  [["servicio", "luz", "gas", "agua", "internet", "wifi", "celular", "telefono", "expensas", "factura", "edenor", "edesur", "abl"], "zap"],
  [["hogar", "casa", "depto", "departamento"], "home"],
  [["nafta", "combustible", "ypf", "shell", "axion", "gnc"], "fuel"],
  [["sube", "colectivo", "bondi", "tren", "subte", "micro", "peaje"], "bus"],
  [["taxi", "uber", "cabify", "didi", "remis"], "car"],
  [["mantenimiento", "taller", "mecanico", "arreglo", "service"], "wrench"],
  [["transporte", "auto", "estacionamiento", "cochera", "vtv", "patente"], "car"],
  [["farmacia", "remedio"], "pill"],
  [["obra social", "prepaga", "osde", "swiss", "galeno", "medicus"], "cross"],
  [["salud", "medic", "consulta", "turno", "dentista", "kinesio", "psicolog", "oculista"], "health"],
  [["kiosco", "kiosko", "kiosquito", "maxikiosco"], "store"],
  [["indumentaria", "ropa", "calzado", "zapatilla", "zapato", "remera", "pantalon", "vestido", "campera", "accesorio"], "shirt"],
  [["cuidado personal", "peluqueria", "barberia", "belleza", "cosmetica", "maquillaje", "uñas", "unas", "manicura", "estetica", "perfum", "spa"], "scissors"],
  [["deporte", "gimnasio", "gym", "cancha", "padel", "paddle", "futbol", "crossfit", "pileta", "natacion"], "dumbbell"],
  [["streaming", "netflix", "spotify", "disney", "hbo", "prime video", "youtube"], "tv"],
  [["viaje", "vacacion", "vuelo", "pasaje", "hotel", "airbnb", "excursion"], "plane"],
  [["ocio", "juego", "entreten", "cine", "hobby"], "fun"],
  [["sueldo", "salario", "haberes", "aguinaldo"], "wallet"],
  [["venta", "vendi", "usado", "marketplace"], "coins"],
  [["freelance", "proyecto", "cliente", "changa", "honorarios"], "laptop"],
  [["regalo", "cumple"], "gift"],
  [["reintegro", "devolucion", "reembolso"], "undo"],
  [["interes", "plazo fijo", "dividendo", "cripto"], "percent"],
  [["ahorro", "inversion", "fci"], "piggy"],
  [["extra", "adicional", "bonus", "propina"], "gift"],
  [["otros", "otro", "varios", "misc"], "package"],
];

/** id de icono para una categoría/subcategoría por nombre, o null si no hay match. */
export function categoryIconId(name: string): IconId | null {
  const n = norm(name);
  for (const [keys, id] of RULES) {
    if (keys.some((k) => n.includes(k))) return id;
  }
  return null;
}

export function CategoryIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const [brandFailed, setBrandFailed] = useState(false);
  const id = categoryIconId(name);
  if (!id) return null;

  const src = BRAND_SRC[id];
  if (src && !brandFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setBrandFailed(true)}
        className={cn(
          "size-4 shrink-0 rounded-[3px] object-contain",
          className,
        )}
      />
    );
  }

  const Icon = ICONS[id];
  return (
    <Icon className={cn("size-4 shrink-0 text-muted-foreground", className)} />
  );
}
