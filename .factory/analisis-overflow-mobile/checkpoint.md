# 🛑 Checkpoint de entrega: analisis-overflow-mobile

**Estado:** el hook ya funciona, así que el pipeline avanzó solo: tests RED → loop (pass en el **intento 1 de 5**) → UX (aprobado con observaciones). La etapa ahora es `checkpoint_entrega`.

## Archivos cambiados
- `src/app/(app)/analytics/page.tsx`: los KPIs y el balance achican la fuente con `clamp` y nunca usan elipsis. La 2.ª línea de "Movimientos más grandes" se trunca. Consejos y observaciones usan `break-words`. Se agregó `overflow-x-clip` como red de seguridad.
- `src/components/analytics-bits.tsx` (`BarRow`): la barra ocupa como mínimo el 40% y la meta puede pasar a dos líneas. Solo se usa en Análisis.
- `src/components/analytics/spend-heatmap.tsx` y `src/lib/tooltip-position.ts` (nuevo): el tooltip se acota con el ancho real del contenedor.
- `src/components/analytics/trend-dual.tsx`: la etiqueta del pico se alinea al borde cuando está en el primer o el último mes.
- `src/components/analytics-range.tsx`: `appearance-none` en los campos de fecha (arreglo de WebKit).
- `package.json` (script `test`) y `tests/` (nuevo, con el runner nativo de Node y sin dependencias nuevas).

## Verificación
- `npm test`: **35/35** · `tsc --noEmit`: ok · `npm run build`: ok (CA13).
- `npm run lint`: falla por 3 errores y 2 warnings que **ya estaban en main** (`cosmic-background`, `theme-toggle`, `payment-methods`, `expense-form`, `income-form`). Los archivos de la feature quedan limpios.
- UX: medido en Chromium con datos estresados en 360, 375, 402, 512 y 1280px. **No hay scroll horizontal ni sin `overflow-x-clip`**. Antes, la página medía 531px de ancho. Capturas: `.factory/analisis-overflow-mobile/screenshots/`.

## Observaciones de UX (no hay ALTA)
- **MEDIA:** en "Detalle por categoría" las barras de `BarRow` ya no tienen el mismo ancho en todas las filas (porque la meta ocupa un ancho variable), así que cuesta compararlas, también en desktop. Afecta CA11. La propuesta es pasar la meta a una segunda línea o darle el mismo ancho fijo a toda la lista.
- **BAJA:** el `overflow-x-clip` recorta un poco el `ring` de los Cards y los contornos de foco (se arregla poniéndolo en `main` o con `-mx-1 px-1`). A 360px, en USD, se pierde el nombre del creador en "Movimientos más grandes". El balance en USD queda en dos líneas.

## Pendiente
- **Manual en el iPhone 16 Pro:** CA9 (campos de fecha en Safari) y CA14 (swipe horizontal en PWA y Safari, con capturas).
- **Commits:** sigo **sin permiso** para `git add` y `git commit`, así que todo está sin commitear (incluidos `tests/` y `src/lib/tooltip-position.ts`, que son nuevos).

## Qué responder
1. **"OK, entregá"**: paso a `entrega` (deployer: commit, push y PR). Para eso hay que habilitar `git add` y `git commit` (y `git push`), o commitear a mano.
2. **"Arreglá lo MEDIA antes"** (y, si querés, lo BAJA del clip): vuelvo al loop con el builder y el ux-report.
