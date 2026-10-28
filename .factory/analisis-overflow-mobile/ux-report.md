# UX report — analisis-overflow-mobile

## Veredicto: aprobado con observaciones

No hay hallazgos de severidad ALTA. El desborde horizontal de `/analytics` está corregido en origen: **sin** el `overflow-x-clip`, `scrollWidth === clientWidth` en 360, 375, 402, 512 y 1280px, con ARS y con USD (CA1, CA2, CA12). Antes del cambio, con los mismos datos, el documento medía 531px en 360/375/402.

## Cómo se verificó

La app no se pudo levantar con sesión (Firebase Auth + Neon, sin credenciales de prueba). En su lugar armé un harness **fuera del repo** (`C:\Users\mauri\AppData\Local\Temp\ux-overflow-harness\`):
- Los componentes **reales** (`BarRow`, `TrendDual`, `SpendHeatmap`, `Card`) se renderizaron con SSR usando `tests/setup/ts-loader.mjs`. Las versiones "antes" salieron de `git show main:`.
- El markup de `page.tsx` (Kpi, balance, top movimientos, consejos, observaciones, filtros) se copió con las clases exactas de antes y de después.
- El CSS se compiló con `@tailwindcss/node` sobre `src/app/globals.css`, con la fuente Geist del build (`.next/static`) y en tema oscuro.
- Se midió en Edge headless (Chromium) por CDP, en 360/375/402/512/1280px, en tres variantes: antes, después, y después sin `overflow-x-clip`.
- Datos estresados: montos de $ 25.000.000,00, meta "12 · $ 1.234.567,89/mov" con pct 100, pico en el primer mes y en el último, creador "Maximiliano Alejandro" con "Transferencia" y "MODO crédito", nombres de 33 a 37 caracteres, una URL de 60+ caracteres en consejos y observaciones, el panel de rango personalizado abierto y 3 miembros.

Capturas en `.factory/analisis-overflow-mobile/screenshots/`: `before-{360,375,402,512,1280}.png`, `after-{...}.png` y `zoom-card-edge-{before,after}.png`.

Resultados por criterio (Chromium):
| CA | Resultado |
|---|---|
| CA1/CA2/CA12 | OK. 0 elementos fuera del contenido de `main` y sin scroll horizontal, con y sin clip, en ARS y USD |
| CA3 | OK. La meta larga entra en 1 línea y no sobrepasa la fila. La barra ocupa el 48% de la fila en 360 ARS y el 44% en 360 USD (≥ 40%) |
| CA4 | OK. KPIs en 1 línea, sin elipsis. Holgura mínima: 23px en ARS y 3px en USD a 360px |
| CA5 | OK. ARS en 1 línea a 28.8px en 360px. USD pasa a 2 líneas (ver hallazgo B1) |
| CA6 | OK. El tooltip queda dentro del Card con la celda izquierda y con la derecha en 360/402/512/1280. Antes se salía 39px en 402 |
| CA7 | OK. La etiqueta "$25M" queda a 17px del borde del Card con el pico al inicio y al final |
| CA8 | OK. El monto se ve completo y el tag entero, y trunca fecha · creador (ver M2) |
| CA9 | **No verificado**: depende de WebKit en iOS. En Chromium los inputs quedan dentro de su columna |
| CA10 | OK. La URL corta dentro de la tarjeta. Antes desbordaba 187px en 360 |
| CA11 | Desktop/512 igual que antes en KPIs, balance, gráficos y filtros. **Cambia** en "Detalle por categoría" (ver M1) |
| CA14 | **Pendiente** (manual, en el iPhone 16 Pro) |

## Hallazgos
| Severidad | Pantalla | Problema | Sugerencia |
|---|---|---|---|
| MEDIA | Análisis · Detalle por categoría (`BarRow`) | M1. Con la columna de meta de ancho variable (`min-w-16` sin `shrink-0`), **cada fila tiene un track de distinto ancho**. En 360px ARS miden 158, 187, 200 y 200px (48% a 61%). En 1280 miden 310 a 352px, contra 408px uniformes antes. Como `pct` se dibuja relativo al track, las barras dejan de ser comparables entre filas, y una categoría de 22% puede verse casi tan larga como otra de 30%. Pasa en todos los anchos, desktop incluido, porque en esta sección la meta "N · $ X/mov" siempre supera los 64px, también con datos normales. Es una regresión de lectura respecto de CA11, aunque antes el texto se salía de la fila. En Formas de pago, Subcategorías, Banco e Ingresos (meta corta) no cambia nada | Mantener el track del mismo ancho en todas las filas. Opciones: (a) mover el `· N · $ X/mov` a la primera línea, bajo el label, o a una tercera línea `text-right` debajo de la barra, y dejar `w-16 shrink-0` solo con el `%`; (b) usar un ancho fijo común para la columna de meta solo cuando hay meta larga (prop `metaWidth`/`wideMeta` que el caller pasa igual en todas las filas de la lista). Ninguna de las dos cambia los datos que se muestran |
| BAJA | Análisis · todos los Card | M3. `overflow-x-clip` está en el div raíz, que **no tiene padding**. El `ring-1` de los `Card` (box-shadow exterior de 1px) y los outlines de foco de elementos a todo el ancho (links de "Movimientos más grandes", tabs) se recortan en los lados izquierdo y derecho. En la captura con zoom (`zoom-card-edge-after.png` contra `-before.png`) el borde lateral del Card se ve más tenue. Es sutil porque el ring es `foreground/10`, pero afecta la consistencia con otras pantallas y la visibilidad del foco por teclado | Como el arreglo en origen ya elimina el desborde, la red de seguridad puede ir donde tenga aire. Por ejemplo, `-mx-1 px-1 overflow-x-clip` en el mismo div o el clip en `main`, que tiene `px-4`: el recorte se hace en el borde del padding. `overflow-clip-margin` no sirve en Safari |
| BAJA | Análisis · Movimientos más grandes | M2. El tag de forma de pago es `shrink-0` y lo que trunca es "fecha · creador". En 360px con USD quedan **44px** para ese texto: el creador desaparece y la fecha queda al límite (con "27 sept" puede llegar a cortarse). La fecha es más útil que el nombre del método, que además ya tiene ícono | Darle prioridad a la fecha: separar la fecha en un `<span className="shrink-0">` y dejar `min-w-0 truncate` solo en el creador, o permitir que el label del tag trunque (`min-w-0 truncate` en el texto, con el ícono siempre visible) |
| BAJA | Análisis · Balance del período (USD) | B1. `formatMoney` para USD usa un espacio normal entre "US$" y el número, no uno no separable. Con US$ 25.000.000,00 en 360/375/402 el balance pasa a 2 líneas y queda "−US$" en una y "25.000.000,00" en otra. Cumple CA5 (no suma más de una línea y se lee entero), pero el símbolo queda separado del monto | Sin tocar `formatMoney`: reemplazar `" "` por `"\u00A0"` en el string antes de renderizar en el balance y los KPIs. Si con eso no entra, el `clamp` puede bajar a un mínimo de 1.35rem |
| BAJA | Análisis · KPIs y balance | B2. `wrap-break-word` es el último recurso. Con 9 dígitos en ARS ($ 250.000.000,00) el monto se cortaría **en medio del número** porque el bloque no tiene espacios. Con 8 dígitos (la spec) no pasa: en USD a 360 quedan 3px de holgura | Aceptable para el alcance. Si aparece, conviene el formato compacto de P4 (`$250M`) con el monto exacto en `title` |
| BAJA | Análisis · Mapa de gasto diario | B3. El tooltip se acota con su ancho máximo (200px) y no con el ancho real (~185px). Con la celda de la derecha en ≥402px queda encima de la celda tocada y no al costado. Ya pasaba antes. No se recorta (CA6 OK). El tooltip sigue siendo solo de mouse: sin foco por teclado ni texto accesible para las celdas (también preexistente) | Opcional: medir el tooltip con un ref después de montarlo. Fuera de alcance: `aria-label` por celda o un resumen accesible |
| BAJA | Análisis · Rango personalizado | B4. `appearance-none` en `input[type=date]` no se puede validar sin WebKit/iOS. En Chromium se ve igual que antes y los inputs quedan dentro de la grilla. En iOS, `appearance-none` saca el estilo nativo: con valor vacío el input puede quedar sin texto visible (no hay placeholder) | Verificar en CA14 (iPhone real) con el panel abierto, con fechas cargadas y sin cargar |

## Qué quedó sin verificar en vivo
- La app real con sesión y datos de la base: se midió con un harness que usa los componentes reales y una copia del markup de la página. `CategoryDonut` y `PaceChart` no se renderizaron porque no cambiaron.
- Safari/WebKit en iOS (CA9, CA14) y el comportamiento táctil del tooltip: todo se midió en Chromium.
- Modo claro: las capturas son en tema oscuro.

Se usó un navegador headless que se cerró al terminar. No quedaron servidores corriendo. El harness y sus perfiles temporales quedan en `%TEMP%\ux-overflow-harness\` (se pueden borrar).
