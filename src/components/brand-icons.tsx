import type { SVGProps } from "react";

/** Isotipo simplificado de Mercado Pago: óvalo celeste + apretón de manos amarillo. */
export function MercadoPagoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <ellipse cx="24" cy="24" rx="23" ry="16" fill="#00A5DF" />
      <path
        d="M23 15c-4.2 0-7.7 2.2-9.4 5.3-.7 1.2-.3 2.6.9 3.4l7.9 5c1.1.7 2.6.4 3.3-.7.7-1.1.4-2.6-.7-3.3l-5-3.2c1.1-1 2.7-1.6 4.4-1.5"
        fill="#FFE600"
      />
      <path
        d="M25 33c4.2 0 7.7-2.2 9.4-5.3.7-1.2.3-2.6-.9-3.4l-7.9-5c-1.1-.7-2.6-.4-3.3.7-.7 1.1-.4 2.6.7 3.3l5 3.2c-1.1 1-2.7 1.6-4.4 1.5"
        fill="#FFE600"
      />
    </svg>
  );
}

/** Isotipo simplificado de MODO: cuadrado negro con "m" verde. */
export function ModoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <rect width="48" height="48" rx="12" fill="#0B0B0B" />
      <path
        d="M11 34V19.5c0-2.5 2-4.5 4.5-4.5 1.8 0 3.4 1 4.1 2.6.8-1.6 2.4-2.6 4.2-2.6 2.5 0 4.5 2 4.5 4.5V34h-5V21.5c0-.8-.7-1.5-1.5-1.5s-1.5.7-1.5 1.5V34h-5V21.5c0-.8-.7-1.5-1.5-1.5S16 20.7 16 21.5V34h-5Z"
        fill="#00E19B"
      />
      <circle cx="34.5" cy="30.5" r="3.5" fill="#00E19B" />
    </svg>
  );
}
