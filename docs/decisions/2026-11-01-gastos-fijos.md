# Gastos fijos mensuales por usuario (tablas fixed_bills / fixed_bill_payments) y vitest

- Contexto: cada usuario necesita registrar sus gastos fijos mensuales (teléfono, internet, etc.) y marcarlos como pagados por mes, ya sea creando un gasto o vinculándolo a uno existente, sin duplicar movimientos. En `main` no había un test runner.
- Decisión:
  - Dos tablas nuevas (migración `drizzle/0018_fixed_bills.sql`). `fixed_bills` tiene alcance `(team_id, user_id)`: es privado por usuario dentro del equipo. `fixed_bill_payments` guarda una fila por fijo y mes, con `UNIQUE(bill_id, period)`, `UNIQUE(expense_id)` parcial y `expense_id ON DELETE SET NULL`.
  - No se generan filas por mes: el estado del mes (pagado, pendiente o vencido) se calcula en `src/lib/fixed-bills.ts` y solo se persiste el pago. No hace falta cron.
  - Neon-http no tiene transacciones, así que la atomicidad pago+gasto se resuelve por compensación. Primero se inserta el pago, para que el UNIQUE frene el doble marcado; después se crea el gasto y, si algo falla, se deshacen los pasos anteriores.
  - La UI es un tab "Fijos" dentro de Movimientos (`/movimientos/fijos`), sin agregar ítems al bottom nav.
  - Se adopta `vitest` como devDependency, con el script `npm test`.
- Consecuencias:
  - La migración 0018 no está aplicada en ninguna DB. El usuario la corre en dev y en prod.
  - La numeración 0018 choca con la rama `feat/cuotas` (`0018_installments`): la que se mergee segunda tiene que regenerar su migración.
  - La 0018 incluye `ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'transferencia'` (idempotente), que sincroniza el snapshot de drizzle con un cambio que se había hecho a mano.
  - Los pagos marcados sin registrar el gasto no impactan en Análisis ni en el balance (es intencional).
  - Las features futuras pueden sumar tests con vitest. Una vista de equipo de los fijos o los recordatorios por Telegram requerirían cambiar las queries y el aislamiento por usuario.
