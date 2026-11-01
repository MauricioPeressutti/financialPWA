# 🛑 Checkpoint de entrega: gastos-fijos

## Estado
- **Tests:** 122/122 en verde con vitest 4.0.18 (`npm test`). Los tests no se modificaron después del commit RED.
- **Typecheck:** `tsc --noEmit` OK.
- **Build:** `npm run build` OK. `/movimientos/fijos` es una ruta dinámica.
- **Lint:** los 5 problemas que marca ya estaban en `main`, en archivos que esta feature no toca. Los archivos nuevos o modificados no tienen problemas.
- **Loop:** pasó en el intento 1 de 5. El tester falló al principio por un `EPERM` en `.next`, que era un archivo bloqueado y no un problema del código. Moví `.next` a `.next-locked-old` (sin trackear, la podés borrar a mano) y el build pasó.
- **UX:** aprobado con observaciones. Hay 0 hallazgos ALTA, 6 MEDIA y 12 BAJA. La revisión fue **solo de código, sin capturas**, porque la migración no está aplicada.

## Qué se hizo
- **Datos:** las tablas `fixed_bills` y `fixed_bill_payments`, en `drizzle/0018_fixed_bills.sql`. **No se aplicó en ninguna DB.**
- **Lógica:**
  - Lógica pura: `src/lib/fixed-bills.ts`.
  - Queries: `src/lib/fixed-bills-queries.ts`.
  - Actions: `src/lib/actions/fixed-bills.ts`. Aíslan por usuario y por equipo y protegen contra el doble marcado. Como neon-http no tiene transacciones, si falla un paso se deshacen los anteriores.
- **UI:** tab "Fijos" en Movimientos, pantalla `/movimientos/fijos` con selector de mes, banda resumen y los diálogos "Ya lo pagué", "Vincular" y alta/edición. También hay una sección "Archivados (n)".

## Observaciones UX MEDIA (no bloquean)
1. Editar un fijo solo se puede tocando el nombre, y en mobile nada indica que se puede tocar.
2. En tema claro, el contraste de los badges Vencido, Pagado y Sugerido no llega a 4,5:1.
3. El ítem "Desmarcar" del menú mide unos 28 px de alto (la spec pide 40).
4. El formulario de alta y edición no tiene botón Cancelar.
5. En 360 px, un nombre largo en el título del diálogo puede quedar tapado por la X.
6. El foco automático en el monto hace que el teclado del iPhone tape "Confirmar".

## A tener en cuenta
- **Migración:** la rama `feat/cuotas` también usa el número `0018`. La que se mergee segunda tiene que regenerar la suya. Además, la `0018` incluye un `ADD VALUE IF NOT EXISTS 'transferencia'`, que es idempotente.
- **Pendiente:** CA24 y CA28 (prueba en navegador en 360 y 402 px, con capturas) necesitan aplicar la `0018` en la DB de dev. La migración contra prod la corrés vos.

## Qué necesito que respondas
- **OK:** paso a la entrega (deployer: commit, push y PR contra `main`).
- **Corregir antes las 6 MEDIA:** hago otra vuelta de builder y UX.
- También podés pedirme otro cambio.
