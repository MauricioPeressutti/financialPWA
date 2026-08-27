import type { ComponentType } from "react";
import { Banknote, CreditCard } from "lucide-react";

import { MercadoPagoIcon, ModoIcon } from "@/components/brand-icons";

export const PAYMENT_METHODS = [
  "efectivo",
  "debito",
  "credito",
  "modo_debito",
  "modo_credito",
  "mercadopago",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

type IconComponent = ComponentType<{ className?: string }>;

export const paymentMethodMeta: Record<
  PaymentMethod,
  { label: string; Icon: IconComponent }
> = {
  efectivo: { label: "Efectivo", Icon: Banknote },
  debito: { label: "Débito", Icon: CreditCard },
  credito: { label: "Crédito", Icon: CreditCard },
  modo_debito: { label: "MODO débito", Icon: ModoIcon },
  modo_credito: { label: "MODO crédito", Icon: ModoIcon },
  mercadopago: { label: "Mercado Pago", Icon: MercadoPagoIcon },
};

export const paymentMethodLabels: Record<string, string> = Object.fromEntries(
  Object.entries(paymentMethodMeta).map(([k, v]) => [k, v.label]),
);

/** Icono + nombre de la forma de pago. */
export function PaymentMethodTag({
  method,
  className,
}: {
  method: string;
  className?: string;
}) {
  const meta = paymentMethodMeta[method as PaymentMethod];
  if (!meta) return <span className={className}>{method}</span>;
  const { label, Icon } = meta;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <Icon className="size-3.5 shrink-0" />
      {label}
    </span>
  );
}
