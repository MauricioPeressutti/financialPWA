import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { exchangeRates } from "@/db/schema";
import {
  fxReferenceLabel as FX_LABELS,
  type Currency,
  type FxReference,
} from "@/lib/currencies";

const DOLARAPI: Record<FxReference, string> = {
  blue: "https://dolarapi.com/v1/dolares/blue",
  oficial: "https://dolarapi.com/v1/dolares/oficial",
  mep: "https://dolarapi.com/v1/dolares/bolsa",
  cripto: "https://dolarapi.com/v1/dolares/cripto",
};

const todayAr = () =>
  new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Argentina/Buenos_Aires",
    }),
  )
    .toISOString()
    .slice(0, 10);

/**
 * 1 USD = ? ARS para la referencia dada. Cachea en `exchange_rates` por día.
 * Si dolarapi falla, usa la última cotización guardada. Devuelve null si no hay nada.
 */
export async function getUsdArsRate(
  reference: FxReference,
): Promise<{ rate: number; day: string; stale: boolean } | null> {
  const day = todayAr();

  const [cached] = await db
    .select()
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.day, day),
        eq(exchangeRates.base, "USD"),
        eq(exchangeRates.quote, "ARS"),
        eq(exchangeRates.reference, reference),
      ),
    )
    .limit(1);
  if (cached) return { rate: cached.rate, day, stale: false };

  try {
    const res = await fetch(DOLARAPI[reference], {
      signal: AbortSignal.timeout(6000),
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const j = (await res.json()) as { compra?: number; venta?: number };
      const compra = Number(j.compra) || 0;
      const venta = Number(j.venta) || 0;
      const rate = compra && venta ? (compra + venta) / 2 : venta || compra;
      if (rate > 0) {
        await db
          .insert(exchangeRates)
          .values({
            day,
            base: "USD",
            quote: "ARS",
            reference,
            rate,
            source: "dolarapi",
          })
          .onConflictDoNothing();
        return { rate, day, stale: false };
      }
    }
  } catch {
    // sigue al fallback
  }

  const [last] = await db
    .select()
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.base, "USD"),
        eq(exchangeRates.quote, "ARS"),
        eq(exchangeRates.reference, reference),
      ),
    )
    .orderBy(desc(exchangeRates.day))
    .limit(1);
  if (last) return { rate: last.rate, day: last.day, stale: true };

  return null;
}

/**
 * "1 `currency` = fxRate `primary`". Devuelve null si hace falta que el
 * usuario lo cargue a mano (par no soportado automáticamente).
 */
export async function resolveFxRate(
  currency: Currency,
  primary: Currency,
  reference: FxReference,
): Promise<{ rate: number; stale: boolean } | null> {
  if (currency === primary) return { rate: 1, stale: false };

  if (currency === "USD" && primary === "ARS") {
    const r = await getUsdArsRate(reference);
    return r ? { rate: r.rate, stale: r.stale } : null;
  }
  if (currency === "ARS" && primary === "USD") {
    const r = await getUsdArsRate(reference);
    return r ? { rate: 1 / r.rate, stale: r.stale } : null;
  }
  // EUR u otros pares: a mano
  return null;
}

/** Convierte un monto a la moneda principal usando "1 currency = fxRate primary". */
export function toBaseCents(amountCents: number, fxRate: number): number {
  return Math.round(amountCents * fxRate);
}

/** Contexto de monedas para los formularios / listados de un equipo. */
export async function getFxContext(team: {
  primaryCurrency: string;
  currencies: string[];
  fxReference: string;
}) {
  const usesUsd =
    team.currencies.includes("USD") || team.primaryCurrency === "USD";
  const needsArsUsd =
    usesUsd &&
    (team.primaryCurrency === "ARS" || team.primaryCurrency === "USD");
  let usdArsRate: number | null = null;
  let stale = false;
  if (needsArsUsd) {
    const r = await getUsdArsRate(team.fxReference as FxReference);
    if (r) {
      usdArsRate = r.rate;
      stale = r.stale;
    }
  }
  return {
    primaryCurrency: team.primaryCurrency,
    currencies:
      team.currencies.length > 0 ? team.currencies : [team.primaryCurrency],
    fxReference: team.fxReference,
    fxReferenceLabel:
      FX_LABELS[team.fxReference as FxReference] ?? team.fxReference,
    usdArsRate,
    stale,
  };
}

export type FxContext = Awaited<ReturnType<typeof getFxContext>>;

/**
 * Resuelve el TC a usar para un movimiento: 1 si es la moneda principal,
 * el valor manual si vino, o la cotización automática. `error` != null =>
 * el par no se pudo resolver y hay que pedirlo a mano.
 */
export async function fxForMovement(
  team: { primaryCurrency: string; fxReference: string },
  currency: string,
  manualRate?: string | null,
): Promise<{ fxRate: number; stale: boolean; error?: string }> {
  if (currency === team.primaryCurrency) return { fxRate: 1, stale: false };

  const manual = manualRate
    ? Number(String(manualRate).replace(/\./g, "").replace(",", "."))
    : NaN;
  if (Number.isFinite(manual) && manual > 0)
    return { fxRate: manual, stale: false };

  const r = await resolveFxRate(
    currency as Currency,
    team.primaryCurrency as Currency,
    team.fxReference as FxReference,
  );
  if (!r)
    return {
      fxRate: 1,
      stale: false,
      error:
        "No pude traer el tipo de cambio automáticamente. Cargalo a mano en el formulario.",
    };
  return { fxRate: r.rate, stale: r.stale };
}
