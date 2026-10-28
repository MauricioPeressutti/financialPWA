# Test plan

## Runner elegido y justificación
El repo no tenía test runner. Se eligió **`node:test` (runner nativo de Node 22.19) sin dependencias nuevas**:
- Un hook de carga (`tests/setup/ts-loader.mjs`, registrado por `tests/setup/register.mjs`) transpila `.ts/.tsx` con el `typescript` que ya está en devDependencies (JSX -> `react/jsx-runtime`) y resuelve el alias `@/` -> `src/`.
- Los componentes sin hooks (`BarRow`, `TrendDual`) se invocan como funciones y se inspecciona el árbol de elementos de React (no hace falta DOM ni jsdom).
- La página `/analytics` (Server Component async con DB; `Kpi` no exportado), `SpendHeatmap` (usa hooks) y `AnalyticsRange` (usa `next/navigation`) se verifican con **contratos sobre el código fuente** (clases Tailwind en el markup).
- No hay layout real: los anchos efectivos (CA1, CA2, CA9, CA11, CA14) quedan manuales.
- Los tests son `.mjs` en `tests/`, fuera del `include` de `tsconfig.json`, así que no afectan `next build`. `npx eslint tests` pasa.

| Criterio | Test(s) | Archivo | Estado inicial |
|---|---|---|---|
| CA1 | Manual: DevTools 402x874 con datos estresados, rangos 1w/1m/3m/6m y ARS/USD; snippet de la spec (`main *` con `right > clientWidth`) | - | MANUAL |
| CA2 | Manual: igual que CA1 en 375x667 y 360x740 | - | MANUAL |
| CA3 | debería no usar ninguna columna de ancho fijo w-16 para % y meta | tests/analytics/bar-row.test.mjs | FAIL (esperado) |
| CA3 | debería permitir que la meta se corte en varias líneas (min-w-0 + wrap) sin truncarla | tests/analytics/bar-row.test.mjs | FAIL (esperado) |
| CA3 | debería reservar al menos 40% del ancho de la fila para la barra cuando comparte fila con la meta | tests/analytics/bar-row.test.mjs | FAIL (esperado) |
| CA3 (regresión) | debería seguir mostrando el porcentaje y la meta completos / debería mantener el label truncado y el monto sin encoger / debería funcionar sin meta | tests/analytics/bar-row.test.mjs | PASS (guarda de regresión) |
| CA4 | debería permitir que la caja del KPI se encoja dentro de la grilla (min-w-0) | tests/analytics/analytics-page.test.mjs | FAIL (esperado) |
| CA4 | debería achicar la fuente o cortar la línea del valor para que entre en 360px | tests/analytics/analytics-page.test.mjs | FAIL (esperado) |
| CA4 | debería permitir el corte de línea del sub | tests/analytics/analytics-page.test.mjs | FAIL (esperado) |
| CA4 (regresión) | debería no recortar nunca el monto con elipsis | tests/analytics/analytics-page.test.mjs | PASS (guarda) |
| CA5 | debería reducir la fuente del balance (clamp) o permitir el corte en lugar de quedar recortado | tests/analytics/analytics-page.test.mjs | FAIL (esperado) |
| CA5 (regresión) | debería no ocultar el número del balance (sin truncate ni overflow-hidden) | tests/analytics/analytics-page.test.mjs | PASS (guarda) |
| CA6 | clampTooltipLeft: celda derecha / izquierda / cualquier posición, en 360px (296px útiles) y 402px (338px útiles); x+offset cuando hay lugar; 0 si el tooltip es más ancho | tests/analytics/heatmap-tooltip.test.mjs | FAIL (esperado, módulo inexistente) |
| CA6 | debería no usar el literal 280 como tope del tooltip / debería usar clampTooltipLeft con el ancho medido del contenedor | tests/analytics/heatmap-tooltip.test.mjs | FAIL (esperado) |
| CA7 | debería alinear la etiqueta a la izquierda cuando el pico es la primera columna / a la derecha cuando es la última | tests/analytics/trend-dual.test.mjs | FAIL (esperado) |
| CA7 (regresión) | debería mantener la etiqueta centrada cuando el pico está en una columna intermedia | tests/analytics/trend-dual.test.mjs | PASS (guarda) |
| CA8 | debería truncar o hacer wrap en la segunda línea (fecha · creador · forma de pago) | tests/analytics/analytics-page.test.mjs | FAIL (esperado) |
| CA8 (regresión) | debería mantener el título truncado y el monto completo (shrink-0) / la columna central encogible (min-w-0 flex-1) | tests/analytics/analytics-page.test.mjs | PASS (guarda) |
| CA9 | Manual: panel de rango abierto en iOS Safari real/simulador | - | MANUAL |
| CA9 (soporte) | debería aplicar appearance-none (o el workaround de WebKit) a cada date input | tests/analytics/analytics-range.test.mjs | FAIL (esperado) |
| CA9 (regresión) | debería haber dos input[type=date] / debería mantener min-w-0 en cada input y en su columna | tests/analytics/analytics-range.test.mjs | PASS (ya cumplido: `Input` base y `<label>` tienen min-w-0) |
| CA10 | debería cortar palabras/URLs largas en los consejos de la IA | tests/analytics/analytics-page.test.mjs | FAIL (esperado) |
| CA10 | debería cortar palabras/URLs largas en las observaciones (wrap-anywhere, o break-words + min-w-0 en el span flex item) | tests/analytics/analytics-page.test.mjs | FAIL (esperado) |
| CA11 | Manual: capturas antes/después en 1280px y 512px | - | MANUAL |
| CA12 / P1 | debería tener overflow-x-clip en el contenedor de la página (no en body) | tests/analytics/analytics-page.test.mjs | FAIL (esperado) |
| CA12 / P1 | debería no usar overflow-hidden/overflow-x-hidden | tests/analytics/analytics-page.test.mjs | PASS (guarda) |
| CA12 | Manual: verificar CA1-CA10 con `overflow-x-clip` desactivado en DevTools | - | MANUAL |
| CA13 | `npm run lint` y `npm run build` (lo corre la fase de verificación) | - | Fuera de los tests unitarios |
| CA14 | Manual obligatorio: iPhone 16 Pro (PWA y Safari), swipe horizontal por sección, capturas en `.factory/analisis-overflow-mobile/` | - | MANUAL |

Resultado inicial: **35 tests, 11 pass (guardas de regresión), 24 fail (RED)**.

## Contratos que la implementación tiene que cumplir
- **Tooltip del heatmap**: crear `src/lib/tooltip-position.ts` con
  `export function clampTooltipLeft(x: number, containerWidth: number, tipWidth: number, offset = 12): number`.
  Devuelve `x + offset` si entra; si no, lo ajusta para que `0 <= left <= containerWidth - tipWidth`; devuelve `0` si `tipWidth > containerWidth`. `spend-heatmap.tsx` lo tiene que usar con el ancho medido (`rect.width`, `offsetWidth` o `clientWidth`) y no puede quedar el literal `280`.
- **BarRow**: ningún `w-<n>` fijo; el elemento que muestra la meta lleva `min-w-0` + `break-words`/`wrap-break-word`, o `wrap-anywhere`/`[overflow-wrap:anywhere]`, sin `truncate`/`whitespace-nowrap`. Si la meta queda en la misma fila que la barra, el track (`bg-muted`) necesita `min-w-[40%]` (o `basis-[>=40%]`), o la meta `max-w-[<=60%]`. Si la meta pasa a su propia línea, no se exige el mínimo.
- **TrendDual**: en la primera columna la etiqueta del pico lleva `left-0` (o `start-0`, o `style.left = 0`); en la última `right-0` (o `end-0`, o `style.right = 0`); en ninguno de los dos casos `-translate-x-1/2`. En las columnas intermedias sigue `left-1/2 -translate-x-1/2`.
- **Kpi**: la caja lleva `min-w-0`; el valor usa `text-[clamp(...)]` o una clase de corte (`break-words`, `wrap-break-word`, `wrap-anywhere`, `[overflow-wrap:anywhere]`, `break-all`); el sub, igual. Nunca `truncate` ni `text-ellipsis`.
- **Balance**: `text-[clamp(...)]` o una clase de corte, sin `truncate` ni `overflow-hidden`.
- **Top movimientos**: la segunda línea `<p>` con `flex-wrap`, o su primer `<span>` (fecha · creador) con `truncate`.
- **Consejos**: alguna clase de corte en el bloque de `aiAdvice.items.map` (el div ya tiene `min-w-0`).
- **Observaciones**: `wrap-anywhere`/`[overflow-wrap:anywhere]`/`break-all`, o `break-words` + `min-w-0` en el `<span dangerouslySetInnerHTML>`.
- **Contenedor de la página**: el `div` raíz de `AnalyticsPage` lleva `overflow-x-clip` (no `overflow-hidden` ni `overflow-x-hidden`).
- **Date inputs**: `className` de cada `<Input type="date">` incluye `appearance-none` (o `[-webkit-appearance:none]` o una regla `[&::-webkit-date-and-time-value]...`).

## Comando para correrlos
```
npm test
```
(equivale a `node --import ./tests/setup/register.mjs --test "tests/**/*.test.mjs"`; para un resumen legible, agregar `--test-reporter=spec`.)

## Stubs creados (si hubo)
Ninguno. No se tocó código de producción. Archivos de infraestructura de tests:
- `tests/setup/ts-loader.mjs`, `tests/setup/register.mjs`, `tests/setup/helpers.mjs`.
- `package.json`: se agregó el script `"test"` (sin dependencias nuevas).
- `clampTooltipLeft` se importa en forma dinámica: si el módulo no existe, los tests fallan con `falta implementar clampTooltipLeft en src/lib/tooltip-position.ts (ERR_MODULE_NOT_FOUND)` en lugar de romper la suite.
