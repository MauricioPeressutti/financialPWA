# Gastos fijos mensuales por usuario ("Fijos")

## Contexto
Pedido: "Necesito que crees un módulo donde se cargan fijos por mes, cada usuario carga el gasto (teléfono), un botón tipo 'ya lo pagué' o que te permita vincularlo a un gasto. Esto sería por usuario, armate un plan e implementalo."

Interpretación: cada persona define sus **gastos fijos** (teléfono, internet, gimnasio, alquiler...), que se repiten **todos los meses**. Para cada mes ve cuáles pagó y cuáles le faltan, y marca cada uno como pagado de una de dos formas:
- **"Ya lo pagué"**: lo marca como pagado. Opcionalmente, en el mismo paso **registra el gasto** en Movimientos.
- **"Vincular a un gasto"**: lo asocia a un gasto que ya existe (por ejemplo, el teléfono que entró con el resumen de la tarjeta o por Telegram), sin duplicar el movimiento.

Qué hay hoy:
- Stack: Next (versión con breaking changes; hay que leer `node_modules/next/dist/docs/` antes de codear), Drizzle + Neon, Server Actions con `requireTeam()` (src/lib/auth.ts). Restricción de costo: $0/mes.
- `expenses` (src/db/schema.ts) pertenece a un equipo (`team_id`) y tiene `created_by_user_id`, `amount_cents`, `currency`, `category_id` (obligatoria), `payment_method`, `spent_on`, `entity` y `description`. `insertExpense()` (src/lib/expenses-core.ts) inserta y devuelve `{ id }`, sin auth ni revalidate. `createExpense` (src/lib/actions/expenses.ts) valida con `expenseInput` (src/lib/validation.ts).
- Patrones similares que conviene seguir:
  - **Objetivos**: `goals` + `goal_contributions`, actions en src/lib/actions/goals.ts con `ActionResult`, filtro `teamId` y alcance personal o compartido mediante `ownerUserId`.
  - **Resúmenes de tarjeta**: estado pagado con `markStatementPaid` y match blando con gastos existentes.
- Navegación: el bottom nav de `AppShell` ya tiene hasta 8 ítems. `Movimientos` tiene tabs (`src/components/movimientos-tabs.tsx`: Gastos | Ingresos) y su `match` cubre `/movimientos*`.
- Migraciones: `drizzle/` llega hasta `0017_game_rounds`. La próxima sería `0018`.
- Fechas: `src/lib/datetime.ts` usa `America/Argentina/Buenos_Aires`.
- No hay test runner en `main`.

## Decisiones de diseño (defaults; ver Preguntas abiertas)
- **Por usuario dentro del equipo activo**: cada fijo pertenece a `(team_id, user_id)`. Cada persona ve y gestiona **solo los suyos** (P1). Si la persona está en dos equipos, sus fijos son por equipo.
- **Sin generación de filas por mes**: un fijo "aplica" a un mes si está activo y fue creado en ese mes o antes. El estado del mes se calcula, y solo se persiste el **pago** (una fila por fijo y mes). No hace falta cron.
- **Monto estimado o real**: el fijo tiene un monto estimado (el teléfono varía cada mes). El pago guarda el monto real.
- **Un gasto se vincula a un solo pago**, y un pago tiene como mucho un gasto.
- **Ubicación**: nuevo tab **"Fijos"** en Movimientos (`/movimientos/fijos`). No cambia el bottom nav.

## Alcance
Entra:
1. **Modelo de datos** (migración `0018_fixed_bills` o el número libre siguiente):
   - `fixed_bills`: `id`, `team_id` (FK cascade), `user_id` (FK users cascade), `name` (texto obligatorio, como mucho 60 caracteres), `emoji` (default "🧾"), `amount_cents` (bigint, >0, monto estimado), `currency` (moneda del equipo), `category_id` (FK categories, **nullable**: es la categoría que se usa al crear el gasto), `payment_method` (enum `payment_method`, default `debito`), `due_day` (int 1..31, nullable: día de vencimiento), `active` (bool, default true), `created_at`. Índice `(team_id, user_id)`.
   - `fixed_bill_payments`: `id`, `bill_id` (FK cascade), `period` (date, siempre el día 1 del mes), `amount_cents` (bigint >0, monto real), `paid_on` (date), `expense_id` (FK expenses, **on delete set null**), `created_expense` (bool: true si el gasto lo creó "Ya lo pagué"), `created_at`. `UNIQUE(bill_id, period)` y `UNIQUE(expense_id)` (parcial, `where expense_id is not null`).
2. **Lógica pura** en `src/lib/fixed-bills.ts` (sin DB):
   - `parsePeriod(str)`: acepta `YYYY-MM`. Si es inválido, devuelve el mes actual en hora de Argentina.
   - `billAppliesTo(bill, period)`.
   - `billStatus(bill, payment|null, period, today)`, que devuelve `"pagado" | "pendiente" | "vencido"`. Es `vencido` si no está pagado y `today > min(due_day, último día del mes)` de ese período. Sin `due_day`, nunca vence. Los meses pasados no pagados cuentan como `vencido` si tienen `due_day` y como `pendiente` si no.
   - `monthSummary(...)`: cantidad pagados/total, monto pagado y monto pendiente (estimado), por moneda.
   - `scoreCandidate(bill, expense)`, para sugerir gastos a vincular (ver CA14).
3. **Server Actions** en `src/lib/actions/fixed-bills.ts`. Todas usan `requireTeam()` y filtran por `team_id = team.id AND user_id = user.id`:
   - `createFixedBill`, `updateFixedBill`, `setFixedBillActive` (archivar o reactivar) y `deleteFixedBill` (borra el fijo y sus pagos; los gastos vinculados **no** se borran).
   - `markFixedBillPaid({ billId, period, amount, paidOn, createExpense })`: crea la fila de pago. Si `createExpense`, inserta el gasto con `insertExpense` usando `categoryId`, `paymentMethod` y `currency` del fijo, `description = name`, `spentOn = paidOn` y `splitMode none`, y lo vincula con `created_expense = true`.
   - `linkFixedBillExpense({ billId, period, expenseId })`: el gasto tiene que ser del mismo equipo. El monto del pago es el del gasto, convertido si la moneda difiere (ver Riesgos), y `paid_on = expense.spent_on`.
   - `unmarkFixedBillPaid({ billId, period })`: borra la fila de pago. **No** borra el gasto, ni siquiera si `created_expense` es true. La UI ofrece un link al gasto para borrarlo a mano (P3).
   - Todas revalidan `/movimientos/fijos`. Las que crean un gasto revalidan además `/`, `/movimientos`, `/analytics` y `/esfuerzo`.
4. **Pantalla `/movimientos/fijos`** (`src/app/(app)/movimientos/fijos/page.tsx`) y el tab "Fijos" en `MovimientosTabs`.
5. **Tests** con vitest (ver P5): lógica pura y actions con la DB mockeada.

NO entra:
- Recordatorios por Telegram o cron de vencimientos (se pueden sumar después, reutilizando `/api/cron/card-reminders`).
- Carga o marcado de fijos desde el bot de Telegram.
- Vista del equipo con los fijos de todos los miembros (P1).
- Frecuencias distintas de mensual (bimestral, anual).
- Reparto del fijo entre miembros (Calculadora de esfuerzo). El gasto creado va con `splitMode: "none"` y se puede editar después desde Movimientos.
- Widget en Inicio (P4).
- Auto-vinculación sin confirmación: el sistema solo **sugiere**.

## UI: comportamiento
- **Encabezado**: `h1` "Movimientos", con el mismo layout que `/movimientos`, y `MovimientosTabs` con tres tabs: Gastos | Ingresos | Fijos.
- **Selector de mes**: `‹ noviembre 2026 ›` con links a `?mes=YYYY-MM`. Por defecto, el mes actual. No permite ir más allá del mes siguiente al actual.
- **Banda resumen** (estilo `rounded-lg bg-muted`): "3 de 5 pagados · $ 45.000 pagado · $ 30.000 pendiente". Si hay más de una moneda, una línea por moneda.
- **Lista** `divide-y` de los fijos que aplican al mes, ordenados así: primero vencidos, después pendientes por `due_day` y al final pagados. Cada fila muestra:
  - Emoji y nombre, y debajo, en `text-xs text-muted-foreground`, "vence el 10" (si hay `due_day`) y la categoría.
  - A la derecha, el monto (el real si está pagado; si no, el estimado con el prefijo "~").
  - Un `Badge` de estado: Pagado (verde), Pendiente (neutro) o Vencido (destructive).
  - Acciones:
    - Si no está pagado: botón primario **"Ya lo pagué"** y botón secundario **"Vincular"**.
    - Si está pagado: "Pagado el 5 nov", link "Ver gasto" (si tiene uno vinculado) y un menú "Desmarcar".
- **Diálogo "Ya lo pagué"** (`Dialog`):
  - Monto, prellenado con el estimado (usa `AmountInput`).
  - Fecha de pago (default: hoy si es el mes actual; si no, el día de vencimiento o el último día del mes).
  - Checkbox **"Registrarlo también como gasto"**: default ON si el fijo tiene categoría. Si no tiene categoría, aparece deshabilitado con el texto "Elegí una categoría en el fijo para registrarlo como gasto".
  - Botones Confirmar y Cancelar.
- **Diálogo "Vincular a un gasto"**: lista de gastos **candidatos** del equipo cuyo `spent_on` cae en el mes del período (más o menos 5 días) y que **no** están vinculados a otro pago. Van ordenados por `scoreCandidate` desc y muestran fecha, categoría, descripción y monto. Los 3 mejores con score de 50 o más llevan la etiqueta "Sugerido". Si no hay candidatos: "No hay gastos de este mes para vincular." y un botón "Ya lo pagué" como alternativa.
- **Gestión de fijos**: botón "+ Fijo" arriba a la derecha (mismo lugar que "+ Gasto" en Movimientos) y un formulario en un `Dialog` o en la página `/movimientos/fijos/nuevo` (lo decide el implementador, siguiendo el patrón de Objetivos). Campos: nombre, emoji, monto estimado, moneda (solo si el equipo tiene más de una), categoría (opcional, categorías de gasto activas), forma de pago (default débito) y día de vencimiento (opcional). Al tocar el nombre de un fijo se abre la edición, que incluye "Archivar" y "Eliminar" con confirmación.
- **Estados**:
  - Vacío sin fijos: panel `cosmic-panel` estilo Tarjetas con "Todavía no cargaste gastos fijos. Agregá el teléfono, internet, el gimnasio…" y el botón "+ Fijo".
  - Vacío en un mes donde ningún fijo aplica: "No tenías fijos en este mes."
  - Cargando: `loading.tsx` con skeleton de lista.
  - Errores de las actions: `toast` (sonner) con el mensaje de `ActionResult.error`.
  - Mientras se envía una acción, los botones quedan deshabilitados para evitar el doble click.
- **Mobile (PWA, iPhone 402px)**: sin scroll horizontal. Los botones de acción tienen como mínimo 40px de alto y bajan a una segunda línea de la fila si no entran. Los diálogos entran en 360px.

## Criterios de aceptación

### Lógica pura (`src/lib/fixed-bills.ts`)
- [ ] CA1: `parsePeriod("2026-11")` devuelve `2026-11-01`. `parsePeriod("2026-13")`, `parsePeriod("abc")` y `parsePeriod(undefined)` devuelven el primer día del mes actual en `America/Argentina/Buenos_Aires`. El test fija el reloj al 2026-11-30T23:30-03:00 y espera noviembre, no diciembre en UTC.
- [ ] CA2: `billAppliesTo`: un fijo creado el 2026-10-15 aplica a octubre y noviembre de 2026, y no a septiembre. Un fijo `active=false` no aplica a meses futuros a su archivado, pero **sí** a los meses que ya tienen pago registrado (un fijo archivado con pago en octubre sigue apareciendo en octubre).
- [ ] CA3: `billStatus` con `due_day = 10` en el período 2026-11: sin pago y `today = 2026-11-10` da `pendiente`. Con `today = 2026-11-11` da `vencido`. Con un pago da `pagado`, sin importar la fecha. Con `due_day = 31` en febrero se usa el último día del mes. Sin `due_day` nunca da `vencido`.
- [ ] CA4: `monthSummary` suma por moneda: pagados con el monto real del pago y pendientes o vencidos con el estimado. Devuelve `paidCount` y `total`.
- [ ] CA5: `scoreCandidate(bill, expense)` devuelve 0..100. Suma puntos por: misma categoría (+40), descripción o entidad que contiene el nombre del fijo sin distinguir mayúsculas ni tildes (+30), monto dentro de ±20% del estimado (+20) y misma moneda (+10). Los tests cubren cada componente y el caso de 0 puntos.

### Server Actions y aislamiento
- [ ] CA6: `createFixedBill` con un nombre vacío, un monto menor o igual a 0 o no parseable, un `due_day` fuera de 1..31 o una categoría de otro equipo o de tipo `income` devuelve `{ok:false, error}` y no inserta. Con datos válidos inserta con `team_id` y `user_id` de la sesión, ignorando cualquier `userId` o `teamId` que venga en el input.
- [ ] CA7: **Aislamiento por usuario**: el usuario B (mismo equipo) no puede leer, editar, archivar, borrar, marcar, vincular ni desmarcar los fijos del usuario A. Todas esas actions responden `{ok:false, error:"Fijo no encontrado"}` y no tocan la DB. La página de B no lista los fijos de A.
- [ ] CA8: **Aislamiento por equipo**: con el equipo activo T2, los fijos que el mismo usuario tiene en T1 no aparecen ni se pueden modificar.
- [ ] CA9: `markFixedBillPaid` con `createExpense=false` crea solo la fila de pago (`expense_id = null`, `created_expense = false`) y no inserta ningún gasto.
- [ ] CA10: `markFixedBillPaid` con `createExpense=true` inserta **un** gasto con la categoría, la forma de pago y la moneda del fijo, `description` igual al nombre, `amount` igual al monto ingresado, `spentOn = paidOn`, `created_by = user` y `splitMode none`, y lo vincula (`created_expense = true`). Si el fijo no tiene categoría, devuelve error y no crea nada. Gasto y pago se crean en una transacción: si falla uno, no queda el otro.
- [ ] CA11: Marcar dos veces el mismo fijo y período devuelve `{ok:false, error:"Ya está marcado como pagado"}`, protegido por `UNIQUE(bill_id, period)`, incluso con requests concurrentes. No se crea un segundo gasto.
- [ ] CA12: `linkFixedBillExpense` con un gasto de otro equipo devuelve error. Con un gasto ya vinculado a otro pago devuelve el error "Ese gasto ya está vinculado a otro fijo" (respaldado por `UNIQUE(expense_id)`). Con un gasto válido crea el pago con `amount_cents` igual al del gasto (si la moneda es la misma), `paid_on = spent_on`, `expense_id` seteado y `created_expense = false`.
- [ ] CA13: `unmarkFixedBillPaid` borra la fila de pago y deja el gasto vinculado intacto, sea creado o vinculado. Después, el estado vuelve a `pendiente` o `vencido` y el gasto queda disponible para volver a vincularse.
- [ ] CA14: Si se borra desde Movimientos un gasto vinculado, el pago queda en estado `pagado` con `expense_id = null` (FK `set null`). La UI deja de mostrar "Ver gasto".
- [ ] CA15: `deleteFixedBill` borra el fijo y sus pagos (cascade) pero **no** borra ningún gasto. `setFixedBillActive(false)` lo saca de los meses futuros y lo mantiene en los meses con pago (CA2).
- [ ] CA16: Las candidatas de "Vincular" incluyen solo gastos del equipo activo con `spent_on` dentro de [primer día del período − 5, último día + 5] y sin vínculo previo. Se ordenan por `scoreCandidate` desc y, a igual score, por la cercanía al `due_day`.

### Pantalla `/movimientos/fijos`
- [ ] CA17: `MovimientosTabs` muestra "Fijos" como tercer tab, activo en `/movimientos/fijos*`, mientras "Gastos" sigue activo solo en `/movimientos` exacto. El bottom nav no cambia y "Movimientos" queda resaltado.
- [ ] CA18: Sin fijos se ve el estado vacío con "+ Fijo". Al crear "Teléfono" (estimado $ 15.000, vence el 10, categoría Servicios), aparece en la lista del mes actual como Pendiente, con "~$ 15.000,00" y "vence el 10".
- [ ] CA19: "Ya lo pagué" con el checkbox activado y el monto cambiado a 16.200: la fila pasa a Pagado con $ 16.200,00, muestra "Ver gasto", y en `/movimientos` aparece un gasto de $ 16.200 en Servicios con la descripción "Teléfono". La banda resumen se actualiza.
- [ ] CA20: "Vincular" lista los gastos del mes, con "Sugerido" en el que coincide, y al elegir uno la fila queda Pagada con el monto de ese gasto. **No** se crea un gasto nuevo: la cantidad de gastos en `/movimientos` no cambia.
- [ ] CA21: El selector de mes navega a `?mes=2026-10` y muestra el estado de octubre. Un `?mes` inválido muestra el mes actual sin error. No se puede avanzar más allá del mes siguiente al actual.
- [ ] CA22: Un fijo con `due_day` vencido y sin pagar aparece primero, con badge Vencido.
- [ ] CA23: Con un segundo usuario del mismo equipo logueado, `/movimientos/fijos` no muestra los fijos del primero (verificación manual de CA7).
- [ ] CA24: Mobile: con viewport de 402x874 y de 360x740, sin scroll horizontal (`documentElement.scrollWidth <= clientWidth`), con los botones de 40px de alto o más y los diálogos completos en pantalla. También se verifica en tema claro y oscuro.
- [ ] CA25: Durante el envío, los botones del diálogo quedan deshabilitados. Un doble click rápido en "Confirmar" no genera dos pagos ni dos gastos (en combinación con CA11).

### Calidad
- [ ] CA26: La migración `0018_*` (o el número libre siguiente) se genera con `npm run db:generate`, crea las dos tablas, los índices únicos y las FKs indicadas, y aplica sobre la DB de desarrollo sin errores. **Contra producción no se aplica** sin la confirmación del usuario.
- [ ] CA27: `npm run lint`, `npm run build` y `npm test` pasan.
- [ ] CA28 (manual en navegador): se recorren CA18-CA24 en `npm run dev` y se adjuntan capturas en mobile en `.factory/gastos-fijos/`.

## Archivos/módulos afectados
- `src/db/schema.ts`: tablas `fixedBills` y `fixedBillPayments` y sus tipos.
- `drizzle/0018_*.sql` y `drizzle/meta/*` (generados).
- `src/lib/fixed-bills.ts` (nuevo): lógica pura.
- `src/lib/queries.ts` o un nuevo `src/lib/fixed-bills-queries.ts` (server-only): `listFixedBillsForMonth(teamId, userId, period)` y `listLinkCandidates(teamId, billId, period)`.
- `src/lib/actions/fixed-bills.ts` (nuevo): Server Actions.
- `src/lib/validation.ts`: esquema zod `fixedBillInput`.
- `src/components/movimientos-tabs.tsx`: tab "Fijos".
- `src/app/(app)/movimientos/fijos/page.tsx` y `loading.tsx` (nuevos), y opcionalmente `nuevo/` y `[id]/editar/`.
- `src/components/fijos/*` (nuevos): `fixed-bill-row`, `mark-paid-dialog`, `link-expense-dialog`, `fixed-bill-form`, `month-picker`.
- Reutiliza sin cambios: `insertExpense` (src/lib/expenses-core.ts), `Dialog`, `Badge`, `Button`, `AmountInput`, `Select`, `PaymentMethodTag`, `formatMoney` y `fmtDay`.
- `package.json` y `vitest.config.ts`, si se adopta vitest (P5).

## Tiene UI: sí

## Riesgos
- **Doble conteo**: si el usuario marca "Ya lo pagué" con el checkbox activado y además el mismo pago entra por el resumen de tarjeta o por Telegram, queda duplicado en Movimientos. Mitigación: el diálogo de "Ya lo pagué" muestra el aviso "Si ya lo cargaste (Telegram, resumen), usá Vincular", y "Vincular" es visible al mismo nivel.
- **Pagos sin gasto no impactan en Análisis**: un fijo marcado sin registrar el gasto no suma en analytics ni en el balance. Es intencional (el gasto puede estar cargado de otra forma), pero hay que explicarlo en el texto de ayuda del checkbox.
- **Moneda distinta al vincular**: si el gasto está en USD y el fijo en ARS, el pago guarda el monto y la **moneda del gasto**. Se agrega la columna `currency` en `fixed_bill_payments` (default: la moneda del fijo) y el resumen agrupa por moneda. No se hace conversión FX.
- **Colisión de migración**: la memoria del proyecto indica que la feature **Cuotas** usa `0018` en otra rama sin mergear. Hay que usar el número libre al momento de mergear y regenerar si choca. La migración en Neon prod la corre el usuario.
- **Zona horaria**: el "mes actual" y el vencimiento tienen que calcularse en hora de Argentina, no en UTC (CA1). En el servidor de Vercel, UTC le gana a Argentina por 3 horas.
- **Tamaño de `MovimientosTabs`**: con tres tabs en 360px entran ("Gastos | Ingresos | Fijos"), pero hay que verificarlo (CA24).
- **Rama base**: el usuario pidió descartar `feature/listar-usuarios` y "lo del health". Esta feature tiene que salir de `main` limpio. También está pendiente la spec `analisis-overflow-mobile`, y conviene no mezclar las dos en la misma rama.
- **"Armate un plan e implementalo"**: esta spec es el plan. La implementación la hacen las etapas siguientes del pipeline.

## Preguntas abiertas
- **P1 (no bloqueante, default: privado)**: ¿los demás miembros del equipo ven tus fijos? Default: **no**, cada uno ve solo los suyos ("esto sería por usuario"). La alternativa es una vista de solo lectura con los fijos de todos y su estado. Cambia queries, CA7 y CA23.
- **P2 (no bloqueante, default: tab en Movimientos)**: ¿preferís "Fijos" como tab de Movimientos (no agrega ítems al bottom nav) o como módulo propio en el nav con un toggle por equipo, como Objetivos y Esfuerzo?
- **P3 (no bloqueante, default: no borrar)**: al desmarcar un pago cuyo gasto se creó con "Ya lo pagué", ¿se borra también ese gasto? Default: no, para no perder datos. Se muestra el link "Ver gasto" para borrarlo a mano.
- **P4 (no bloqueante, default: no)**: ¿agregar en Inicio una tarjeta "Fijos del mes: 3/5 pagados" con los vencidos?
- **P5 (no bloqueante, default: sí)**: no hay test runner en `main`. ¿Se agrega `vitest` (devDependency, $0) con el script `npm test`? Sin esto, los CA1-CA16 se verifican solo con lint, build y pruebas manuales.
- **P6 (no bloqueante, default: no)**: ¿recordatorio por Telegram unos días antes del vencimiento (como con las tarjetas)? Queda para una segunda iteración.

Ninguna pregunta bloquea: con los defaults se puede implementar.
