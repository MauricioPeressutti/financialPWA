import type { ComponentType } from "react";
import { Banknote, CreditCard } from "lucide-react";

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

const BrandImg =
  (src: string, alt: string): IconComponent =>
  ({ className }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />
  );

const ModoIcon = BrandImg("/modo.png", "MODO");
const MercadoPagoIcon = BrandImg("/mercadopago.png", "Mercado Pago");

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
      <Icon className="size-4 shrink-0 rounded-[3px]" />
      {label}
    </span>
  );
}
