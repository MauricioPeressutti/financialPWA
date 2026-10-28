# Análisis: componentes que se salen del contenedor y generan scroll horizontal en mobile

## Contexto
Pedido: "Tengo un bug visual en la vista de análisis: hay algunos componentes que se salen de su respectivo card o contenedor y hacen que se pueda desplazar de izq a derecha la view y queda raro. Estoy probando en un iPhone 16 Pro."

- iPhone 16 Pro en Safari o PWA: viewport de **402 x 874 CSS px**. `AppShell` usa `max-w-lg` (512px) con `main px-4`, así que el ancho útil del contenido es **370px**. Dentro de un `Card` (`--card-spacing` = 16px de cada lado) quedan **unos 338px**.
- Página: `src/app/(app)/analytics/page.tsx`. Componentes: `src/components/analytics-bits.tsx` (`BarRow`, `WeekdayBars`), `src/components/analytics/{category-donut,spend-heatmap,pace-chart,trend-dual}.tsx`, `src/components/analytics-range.tsx`, `analytics-member.tsx` y `currency-tabs.tsx`.
- `formatMoney`/`formatCents` (src/lib/money.ts) usan `Intl.NumberFormat("es-AR")` con 2 decimales. El separador entre `$` y el número es un **espacio no separable** (U+00A0), así que `"$ 12.345,67"` es un bloque que no se corta.
- `Card` (src/components/ui/card.tsx) tiene `overflow-hidden`. Lo que desborda **dentro** de un Card se **recorta** (se ve cortado), pero no genera scroll de página. Lo que desborda **fuera** de un Card (KPIs, filas `BarRow`, top movimientos, consejos y observaciones, filtros) sí agranda el ancho del documento y produce el scroll horizontal.
- No hay ninguna protección global contra desborde horizontal (`html`, `body` y `main` no tienen `overflow-x`).

### Causas encontradas al revisar el código (a confirmar en el dispositivo)
1. **`BarRow`, columna de meta (causa más probable)**: `<span className="w-16 shrink-0 ...">{pct}% · {meta}</span>` tiene un ancho fijo de 64px. En "Detalle por categoría", `meta` es `"{count} · $ 12.345,67/mov"`. El bloque `"$ 12.345,67/mov"` no se corta (unos 90-100px a 0.7rem) y sale por la derecha de la fila. Las filas no están dentro de un Card, así que la página scrollea. Afecta también a Subcategorías, Formas de pago, Banco/billetera e Ingresos por fuente, en menor medida.
2. **KPIs (`Kpi` en page.tsx)**: el valor `text-[1.02rem]` y el `sub` no se cortan ni truncan. En una celda de `grid-cols-2` (unos 157px útiles), montos desde unos `$ 10.000.000,00` desbordan la caja `rounded-xl border`, que no está en un Card.
3. **Balance del período**: `text-[2.4rem]` en una sola línea. Desde unos 8 dígitos con decimales supera los 338px. Está en un Card, así que se ve **recortado** en lugar de scrollear.
4. **Tooltip del heatmap** (`spend-heatmap.tsx`): `left: Math.min(tip.x + 12, 280)` con `max-w-[200px]`. Al tocar un día de la derecha queda fuera del contenedor (280 + 200 > 338). Se recorta por el Card.
5. **Etiqueta del pico en `TrendDual`**: es `absolute`, `whitespace-nowrap` y está centrada sobre la columna. Si el pico es el primer o el último mes, se sale media etiqueta por el borde. Se recorta por el Card.
6. **Top movimientos**: la segunda línea (`flex items-center gap-1`, sin `flex-wrap` ni truncado) con fecha, creador y tag de forma de pago ("Tarjeta de crédito" con ícono) puede ser más ancha que el espacio entre el ícono y el monto.
7. **Rango personalizado (`analytics-range.tsx`)**: en iOS Safari, `input[type=date]` tiene un ancho intrínseco mínimo y suele ignorar `w-full` dentro de grids (bug conocido de WebKit). Con el panel abierto puede desbordar el `grid-cols-2`.

## Alcance
Entra:
- Corregir **en origen** cada desborde de la lista anterior que se confirme, para que ningún elemento de `/analytics` salga de su card o contenedor en anchos de 360 a 430px.
- Que `/analytics` no tenga scroll horizontal en el iPhone 16 Pro (402px), ni en 375px ni en 360px, con datos "estresados" (ver CA).
- Mantener el diseño actual: mismos componentes, colores, tipografías y orden de secciones. Se permiten ajustes como `min-w-0`, `truncate`, `break-words`, `flex-wrap`, reducción responsiva del tamaño de fuente (por ejemplo `text-[clamp(...)]`) o formato compacto (`$12,3M`) solo donde el espacio no alcanza.

NO entra:
- Rediseñar la página o cambiar qué datos se muestran.
- Otras pantallas (Movimientos, Tarjetas, Equipo...), salvo que el arreglo sea en un componente compartido (`BarRow`, `CurrencyTabs`) y el cambio sea compatible hacia atrás.
- Cambiar `formatMoney` o `formatCents` en forma global (lo usan todas las pantallas).
- Infraestructura de tests E2E nueva (ver P2).

## Criterios de aceptación
Definición de "sin desborde": en `/analytics`, `document.documentElement.scrollWidth <= window.innerWidth` (o `document.documentElement.clientWidth`), y ningún descendiente de `main` tiene `getBoundingClientRect().right` mayor que el borde derecho de `main` menos su padding.

"Datos estresados": un equipo de prueba con al menos un gasto de **$ 25.000.000,00** (8 dígitos), una categoría con 12 movimientos o más y un promedio por movimiento de **$ 1.234.567,89** o más, un gasto con forma de pago "Tarjeta de crédito" y creador con nombre largo entre los más grandes, el pico de los últimos 12 meses en el mes actual (última columna), 2 o más miembros, ARS y USD activos, y una categoría o entidad con nombre largo (30 caracteres o más).

- [ ] CA1: Con datos estresados y un viewport de 402x874 (iPhone 16 Pro, en DevTools o en el dispositivo), `/analytics` no tiene scroll horizontal según la definición anterior. Se verifica en los rangos 1 semana, 1 mes, 3 meses y 6 meses, y en las dos monedas.
- [ ] CA2: Igual que CA1 en 375x667 y 360x740.
- [ ] CA3: `BarRow`: con `meta = "12 · $ 1.234.567,89/mov"` y `pct = 100`, el bloque de porcentaje y meta queda **dentro** de la fila (no sobrepasa el borde derecho) y la barra sigue visible con al menos 40% del ancho de la fila en 360px. El texto puede pasar a dos líneas o compactarse, pero no se superpone con la barra ni con el monto.
- [ ] CA4: KPIs: con valores de $ 25.000.000,00 en "Gastado", "Proyección" y "Gasto más grande", el valor y el `sub` quedan dentro del borde de su caja en 360px, sea por reducción de fuente o por corte de línea. Nunca se recorta el monto con elipsis: el número tiene que leerse completo.
- [ ] CA5: Balance del período: con un balance de $ -25.000.000,00, el número se ve **completo** (sin recortar por el Card) en 360px, sin aumentar la altura en más de una línea.
- [ ] CA6: Tooltip del heatmap: al tocar la celda de más a la derecha y la de más a la izquierda, el tooltip queda dentro del Card (no se recorta) en 360px y en 402px.
- [ ] CA7: `TrendDual`: con el pico en la primera columna y con el pico en la última, la etiqueta del pico se ve completa dentro del Card.
- [ ] CA8: Top movimientos: con creador "Maximiliano Alejandro" y método "Tarjeta de crédito", la fila no desborda. La segunda línea se trunca con elipsis o hace wrap, el monto de la derecha queda completo y alineado, y el título trunca como hoy.
- [ ] CA9: Con el panel de rango personalizado abierto en iOS Safari (iPhone 16 Pro real, o simulador si no hay dispositivo), los dos `input[type=date]` quedan dentro de su columna y no hay scroll horizontal.
- [ ] CA10: Consejos de la IA y Observaciones: con un texto que tiene una palabra o URL de 60 caracteres sin espacios, la tarjeta no desborda (`break-words` o `overflow-wrap:anywhere`).
- [ ] CA11: No hay regresiones visuales en desktop (1280px) ni en el ancho máximo de la PWA (512px): mismo layout que antes con datos normales. Se comparan capturas de antes y después.
- [ ] CA12: Si el arreglo agrega una protección global (`overflow-x: clip` en `main` o en el contenedor de análisis, ver P1), los CA1-CA10 se verifican **sin** esa protección, o con ella desactivada temporalmente en DevTools. La protección no puede tapar desbordes reales.
- [ ] CA13: `npm run lint` y `npm run build` pasan.
- [ ] CA14 (manual, obligatorio): el usuario, o quien implemente, abre `/analytics` en el iPhone 16 Pro (PWA y Safari), hace swipe horizontal en cada sección y confirma que la vista no se desplaza. Se adjuntan capturas en 402px de antes y después en `.factory/analisis-overflow-mobile/`.

## Archivos/módulos afectados
- `src/components/analytics-bits.tsx` (`BarRow`): ancho y wrap de la columna de meta, `min-w-0`.
- `src/app/(app)/analytics/page.tsx`: `Kpi` (tamaño o corte del valor y del sub), balance, segunda línea de top movimientos y texto de consejos y observaciones.
- `src/components/analytics/spend-heatmap.tsx`: clamp del tooltip usando el ancho real del contenedor en lugar del literal 280.
- `src/components/analytics/trend-dual.tsx`: alineación de la etiqueta del pico en los extremos.
- `src/components/analytics-range.tsx`: `min-w-0` y `appearance-none` (o el workaround de WebKit) en los date inputs.
- `BarRow` también se usa fuera de Análisis: hay que revisar con Grep sus otros usos y verificar que no cambian.

## Tiene UI: sí

## Riesgos
- **No hay reproducción en el dispositivo**: las causas salen de leer el código y calcular anchos. Es posible que el desborde que ve el usuario sea otro. Mitigación: antes de arreglar, medir en DevTools a 402px con datos reales del usuario (o estresados) qué elemento tiene `right > innerWidth`. Snippet sugerido: recorrer `document.querySelectorAll('main *')` y listar los elementos con `getBoundingClientRect().right > document.documentElement.clientWidth`.
- **Datos reales distintos de los estresados**: la causa 1 aparece desde unos $ 1.000/mov, o sea casi siempre. Las causas 2, 3 y 5 dependen de los montos.
- **Ocultar en lugar de arreglar**: un `overflow-x: hidden` global elimina el síntoma, pero deja contenido cortado y en iOS puede romper `position: sticky` del header. Si se usa, que sea `overflow-x: clip` y solo como red de seguridad (CA12).
- **`BarRow` es compartido**: un cambio de layout puede alterar otras pantallas.
- **Sin test runner** en `main`: la verificación es manual y por medición en DevTools (ver P2).
- **Estado de la rama**: el usuario pidió descartar `listar-usuarios` (rama `feature/listar-usuarios`) y "lo del health". Esta feature tiene que salir de `main` limpio, no de esa rama.

## Preguntas abiertas
- **P1 (no bloqueante, default: sí, como red de seguridad)**: además de los arreglos puntuales, ¿agregar `overflow-x: clip` al contenedor de la página de Análisis (no a `body`)? Se recomienda sí, siempre que se cumpla CA12.
- **P2 (no bloqueante, default: no)**: ¿agregar un test automatizado de "sin scroll horizontal" con Playwright y viewport de iPhone? Implica una nueva devDependency y un browser. Por defecto, la verificación queda manual (CA1-CA14 medidos en DevTools más la prueba en el dispositivo).
- **P3 (no bloqueante)**: ¿en qué sección notás el desplazamiento (KPIs, "Detalle por categoría", movimientos...) y con qué moneda o rango? Ayudaría a confirmar la causa. Si no responde, se arreglan las 7.
- **P4 (no bloqueante, default: wrap o reducción de fuente)**: para montos muy grandes en KPIs y balance, ¿preferís que la fuente se achique o que se muestren compactos (`$25M`)? Por defecto se reduce la fuente y se mantiene el monto exacto.

Ninguna pregunta bloquea.
