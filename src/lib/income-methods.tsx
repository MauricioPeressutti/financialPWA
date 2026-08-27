import type { ComponentType } from "react";
import { Banknote, ArrowLeftRight, Receipt, Wallet } from "lucide-react";

export const INCOME_METHODS = [
  "efectivo",
  "transferencia",
  "mercadopago",
  "cheque",
  "otro",
] as const;

export type IncomeMethod = (typeof INCOME_METHODS)[number];

type IconComponent = ComponentType<{ className?: string }>;

const MpIcon: IconComponent = ({ className }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/mercadopago.png" alt="Mercado Pago" className={className} loading="lazy" decoding="async" />
);

export const incomeMethodMeta: Record<
  IncomeMethod,
  { label: string; Icon: IconComponent }
> = {
  efectivo: { label: "Efectivo", Icon: Banknote },
  transferencia: { label: "Transferencia", Icon: ArrowLeftRight },
  mercadopago: { label: "Mercado Pago", Icon: MpIcon },
  cheque: { label: "Cheque", Icon: Receipt },
  otro: { label: "Otro", Icon: Wallet },
};

export const incomeMethodLabels: Record<string, string> = Object.fromEntries(
  Object.entries(incomeMethodMeta).map(([k, v]) => [k, v.label]),
);

export function IncomeMethodTag({
  method,
  className,
}: {
  method: string;
  className?: string;
}) {
  const meta = incomeMethodMeta[method as IncomeMethod];
  if (!meta) return <span className={className}>{method}</span>;
  const { label, Icon } = meta;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <Icon className="size-4 shrink-0 rounded-[3px]" />
      {label}
    </span>
  );
}
