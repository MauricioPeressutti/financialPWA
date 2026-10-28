# Build log — analisis-overflow-mobile

## Intento 1
- Cambios:
  - `src/lib/tooltip-position.ts` (nuevo) → `clampTooltipLeft(x, containerWidth, tipWidth, offset = 12)`: devuelve `x + offset` si entra, si no lo acota a `[0, containerWidth - tipWidth]`, y devuelve 0 si el tooltip es más ancho que el contenedor (causa 4).
  - `src/components/analytics/spend-heatmap.tsx` → el estado del tooltip guarda `w: rect.width` (ancho medido del contenedor `.relative`). `left` pasa a `clampTooltipLeft(tip.x, tip.w, TIP_MAX_W)` con `TIP_MAX_W = 200` (igual que `max-w-[200px]`). Se quitó el literal 280.
  - `src/components/analytics/trend-dual.tsx` → la etiqueta del pico se ancla con `left-0` en la primera columna y con `right-0` en la última. En las del medio sigue `left-1/2 -translate-x-1/2` (causa 5).
  - `src/components/analytics-bits.tsx` (`BarRow`) → el track lleva `min-w-[40%] flex-1`. La columna `%`/meta pasa de `w-16 shrink-0` a `min-w-16 ... wrap-anywhere`: con metas cortas mide lo mismo que antes (64px, barras alineadas); con metas largas crece hasta el 60% de la fila y hace wrap (causa 1). Label (`min-w-0 truncate`) y monto (`shrink-0`) sin cambios. Grep: `BarRow` solo se usa en `src/app/(app)/analytics/page.tsx`, así que no afecta otras pantallas.
  - `src/app/(app)/analytics/page.tsx`:
    - `Kpi` → la caja lleva `min-w-0`. El valor pasa de `text-[1.02rem]` a `text-[clamp(0.8rem,4vw,1.02rem)]` + `wrap-break-word`, y el sub lleva `wrap-break-word`. Sin truncate ni elipsis (causa 2, P4: se achica la fuente).
    - Balance → `text-[clamp(1.5rem,8vw,2.4rem)]` + `wrap-break-word` (causa 3). Cuenta: "−$ 25.000.000,00" mide unos 9.6em; en 360px son 28.8px, unos 276px, menos que los 296px útiles. En 402px, unos 309px contra 338px. Desde unos 480px queda en 2.4rem, como antes.
    - Top movimientos → el `<span>` de fecha · creador lleva `min-w-0 truncate`, y `PaymentMethodTag`/`IncomeMethodTag` reciben `className="shrink-0 whitespace-nowrap"`, así que el tag de forma de pago se ve entero y el que trunca es el creador (causa 6).
    - Consejos de la IA → `wrap-break-word` en el título y el detalle (el div padre ya tenía `min-w-0`). Observaciones → `min-w-0 wrap-break-word` en el `<span dangerouslySetInnerHTML>` (CA10).
    - El `div` raíz de `AnalyticsPage` lleva `overflow-x-clip`, solo como red de seguridad (P1/CA12). No va en body, y no se usó `overflow-hidden`.
  - `src/components/analytics-range.tsx` → los dos `input[type=date]` llevan `appearance-none text-left [&::-webkit-date-and-time-value]:text-left`, el workaround de WebKit para iOS (causa 7). `min-w-0` ya venía de `Input` y de los `<label>`.
- Tests locales: **35 pasan / 0 fallan** (`npm test`).
- `npx tsc --noEmit`: OK (sin errores).
- `npm run lint`: 3 errores y 2 warnings, todos de antes y en archivos que no se tocaron (`cosmic-background.tsx`, `theme-toggle.tsx`, `payment-methods.tsx:20` display-name, y `expense-form.tsx`/`income-form.tsx` como warnings). `npx eslint` sobre los 6 archivos tocados: 0 problemas.
- Se compilaron las clases nuevas con el `compile` de tailwindcss 4.3.3 para confirmar el CSS: `text-[clamp(...)]` da `font-size: clamp(...)`, `wrap-anywhere`/`wrap-break-word` dan `overflow-wrap`, `overflow-x-clip` y el selector `::-webkit-date-and-time-value` salen bien.
- Notas / dudas:
  - No se corrió `npm run build` (CA13). Lo cubre la fase de verificación.
  - Quedan pendientes las verificaciones manuales de CA1, CA2, CA9, CA11, CA12 (con `overflow-x-clip` desactivado) y CA14 en el iPhone 16 Pro.
  - Cambio visual chico en `BarRow`: con metas largas ("12 · $ 1.234.567,89/mov") la barra de esa fila es más corta que las demás. Antes el texto se salía de la fila. Con metas cortas no hay cambio.
  - El tooltip del heatmap se acota con su ancho máximo (200px), no con el ancho real del tooltip. Puede quedar un poco más a la izquierda de lo necesario si el texto es corto, pero nunca se sale.
  - No se tocaron `formatMoney` ni `formatCents`.
