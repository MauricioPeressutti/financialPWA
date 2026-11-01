# Test plan — gastos-fijos

Runner: **vitest 4.0.x** (devDependency; 4.0 porque vitest 5 pide `@types/node >=22` y npm 10.9 tira un bug de arborist con 4.1). `npm test` = `vitest run`. Config en `vitest.config.ts` (alias `@/` → `src/`, `server-only` → stub vacío, `TZ=UTC` para simular Vercel).

Estado inicial: **122 tests, 116 FAIL (esperado) y 6 PASS** (los del arnés `src/test/fake-db.test.ts`, que tienen que quedar siempre en verde). Todos los FAIL son por funcionalidad faltante: stub "no implementado", tabla ausente en el schema o export ausente. Ninguno es por configuración ni por imports rotos.

| Criterio | Test(s) | Archivo | Estado inicial |
|---|---|---|---|
| CA1 | parsePeriod "2026-11" → "2026-11-01"; inválidos/undefined → mes actual AR con reloj 2026-11-30T23:30-03:00; todayAR | src/lib/fixed-bills.test.ts | FAIL (esperado) |
| CA2 | creado 2026-10-15 aplica oct/nov y no sep; mes de creación en hora AR; createdAt string; archivado sin pago no aplica; archivado con pago sí aplica | src/lib/fixed-bills.test.ts, src/lib/fixed-bills-queries.test.ts | FAIL (esperado) |
| CA3 | due 10: today 10 → pendiente, 11 → vencido; pago → pagado; due 31 en feb; sin due nunca vence; meses pasados; mes futuro | src/lib/fixed-bills.test.ts | FAIL (esperado) |
| CA4 | monthSummary por moneda (real vs. estimado), paidCount/total, pago en moneda distinta, lista vacía | src/lib/fixed-bills.test.ts | FAIL (esperado) |
| CA5 | scoreCandidate: 0, +40 categoría, sin categoría, +30 descripción (mayúsculas/tildes), +30 entidad (sin doble suma), +20 ±20% con bordes, +10 moneda, 100 | src/lib/fixed-bills.test.ts | FAIL (esperado) |
| CA6 | createFixedBill rechaza: nombre vacío/>60, monto 0/negativo/no parseable/vacío, due_day 0/32/no numérico, categoría de otro equipo/income/inexistente, sin tocar la DB. Alta válida con team/user de la sesión (ignora userId/teamId del input), defaults, moneda, bordes 1 y 31; update valida igual | src/lib/actions/fixed-bills.test.ts | FAIL (esperado) |
| CA7 | Usuario B (T1) contra el fijo de A: update/setActive/delete/mark (con y sin gasto)/link/unmark → `{ok:false,error:"Fijo no encontrado"}`, snapshot de DB intacto y 0 escrituras. listFixedBillsForMonth de B no lista los de A | src/lib/actions/fixed-bills.test.ts, src/lib/fixed-bills-queries.test.ts | FAIL (esperado) |
| CA8 | Mismo usuario con equipo activo T2 contra su fijo de T1: la misma matriz de CA7; el listado de T2 no muestra T1 | ídem | FAIL (esperado) |
| CA9 | mark sin gasto: 1 pago (expenseId null, createdExpense false), 0 gastos; período "YYYY-MM" se normaliza a día 1; monto inválido no toca la DB | src/lib/actions/fixed-bills.test.ts | FAIL (esperado) |
| CA10 | mark con gasto: un gasto con categoría, forma de pago y moneda del fijo, description = nombre, monto ingresado, spentOn = paidOn, created_by = user, splitMode none; pago vinculado con createdExpense true; revalida las 5 rutas. Sin categoría: error y nada creado. Atomicidad: si falla el insert del pago no queda el gasto, y si falla el del gasto no queda el pago | src/lib/actions/fixed-bills.test.ts | FAIL (esperado) |
| CA11 | Ya pagado → "Ya está marcado como pagado" sin segundo gasto; 2 requests concurrentes → 1 pago y 1 gasto; vincular sobre un período pagado → mismo error. Schema: UNIQUE(bill_id, period) | src/lib/actions/fixed-bills.test.ts, src/db/fixed-bills-schema.test.ts | FAIL (esperado) |
| CA12 | link: gasto de otro equipo o inexistente → error sin escribir; gasto ya vinculado → "Ese gasto ya está vinculado a otro fijo"; 2 links concurrentes del mismo gasto → uno falla con ese error; gasto válido → pago con monto y fecha del gasto, createdExpense false, sin gastos nuevos; moneda distinta → guarda monto y moneda del gasto. Schema: UNIQUE parcial(expense_id) | ídem | FAIL (esperado) |
| CA13 | unmark borra el pago y deja el gasto (creado o vinculado); solo borra el período pedido; después el estado vuelve a pendiente/vencido y el gasto se puede volver a vincular | src/lib/actions/fixed-bills.test.ts, src/lib/fixed-bills.test.ts | FAIL (esperado) |
| CA14 | `deleteExpense` (real) de un gasto vinculado → el pago queda con expenseId null y estado pagado. Schema: FK expense_id ON DELETE SET NULL | src/lib/actions/fixed-bills.test.ts, src/db/fixed-bills-schema.test.ts, src/lib/fixed-bills.test.ts | FAIL (esperado) |
| CA15 | deleteFixedBill borra el fijo y sus pagos, ningún gasto y ningún delete sobre `expenses`; archivar lo saca de los meses futuros y lo mantiene donde hay pago. Schema: FK bill_id CASCADE | src/lib/actions/fixed-bills.test.ts, src/lib/fixed-bills-queries.test.ts, src/db/fixed-bills-schema.test.ts | FAIL (esperado) |
| CA16 | candidateWindow [1º−5, último+5]; rankLinkCandidates filtra por ventana (bordes incluidos) y vínculo, ordena por score y después por cercanía al due_day, "Sugerido" para el top-3 con ≥50; listLinkCandidates: solo equipo activo, ventana, sin vínculo; [] si el fijo no es del usuario/equipo | src/lib/fixed-bills.test.ts, src/lib/fixed-bills-queries.test.ts | FAIL (esperado) |
| CA17 | MOVIMIENTOS_TABS = Gastos/Ingresos/Fijos; "Fijos" activo en /movimientos/fijos*; "Gastos" solo en /movimientos exacto; "Ingresos" no se activa en fijos | src/components/movimientos-tabs.test.ts | FAIL (esperado) |
| CA21 (lógica) | maxSelectablePeriod = mes siguiente; shiftPeriod cruza años | src/lib/fixed-bills.test.ts | FAIL (esperado) |
| CA22 (lógica) | sortMonthItems: vencidos → pendientes por due_day (sin due al final) → pagados | src/lib/fixed-bills.test.ts | FAIL (esperado) |
| UI "Ya lo pagué" (fecha) | defaultPaidOn: hoy si es el mes actual; si no, el vencimiento acotado o el último día | src/lib/fixed-bills.test.ts | FAIL (esperado) |
| CA26 (parte) | columnas, defaults, nullables, FKs e índices de `fixed_bills` y `fixed_bill_payments` vía `getTableConfig` | src/db/fixed-bills-schema.test.ts | FAIL (esperado) |

**No automatizados (quedan para tester / ux-reviewer):** CA17 (la parte de que el bottom nav no cambia: `BASE_NAV` no se exporta y el match `/movimientos` ya cubre `/movimientos/fijos`), CA18, CA19, CA20, CA21 (navegación real), CA22 (render), CA23, CA24, CA25 (doble click en la UI; el backend ya lo cubre CA11), CA26 (generar con `npm run db:generate` y aplicar en dev), CA27 (`lint`/`build`/`test` verdes al final) y CA28 (manual con capturas).

## Comando para correrlos
```
npm test                                  # todo
npx vitest run src/lib/fixed-bills.test.ts
npx vitest run src/lib/actions/fixed-bills.test.ts
```

## Contratos que esperan los tests (para el builder)

### Schema (`src/db/schema.ts`)
- `export const fixedBills = pgTable("fixed_bills", …)`. JS keys: `id, teamId, userId, name, emoji, amountCents, currency, categoryId, paymentMethod, dueDay, active, createdAt`. SQL: `team_id` (FK teams cascade, notNull), `user_id` (FK users cascade, notNull), `name` notNull, `emoji` default `"🧾"`, `amount_cents` bigint mode number notNull, `currency` notNull, `category_id` FK categories nullable, `payment_method` (enum `paymentMethod`) default `"debito"`, `due_day` int nullable, `active` default true, `created_at`. Índice cuyas dos primeras columnas sean `(team_id, user_id)`.
- `export const fixedBillPayments = pgTable("fixed_bill_payments", …)`. JS keys: `id, billId, period, amountCents, currency, paidOn, expenseId, createdExpense, createdAt`. `bill_id` FK fixed_bills **cascade**, `period` date notNull, `amount_cents` bigint, `currency` notNull, `paid_on` date notNull, `expense_id` FK expenses **set null** nullable, `created_expense` default false.
- Índices con **estos nombres exactos** (el FakeDb los usa en `cause.constraint`): `uniqueIndex("fixed_bill_payments_bill_period_idx").on(billId, period)` y `uniqueIndex("fixed_bill_payments_expense_idx").on(expenseId).where(sql\`expense_id is not null\`)`.

### Lógica pura (`src/lib/fixed-bills.ts`, ya existe un stub con tipos y firmas)
- Tipos: `BillStatus`, `FixedBillLike`, `FixedBillPaymentLike`, `CandidateExpense`, `MonthItem {bill, payment|null}`, `MonthSummary {paidCount, total, byCurrency: Record<cur,{paidCents,pendingCents}>}` y `RankedCandidate {expense, score, suggested}`.
- `parsePeriod(input?) → "YYYY-MM-01"`; `todayAR(now?) → "YYYY-MM-DD"`; `periodLastDay(p)`; `dueDateFor(p, dueDay|null) → string|null`; `shiftPeriod(p, delta)`; `maxSelectablePeriod(today)`.
- `billAppliesTo(bill, period, payment?)`: con pago → true; si no, `active && period >= mes de creación (AR)`.
- `billStatus(bill, payment|null, period, today)`. Fechas como string `YYYY-MM-DD`.
- `monthSummary(items)`: los pagados se agrupan por `payment.currency` y los no pagados por `bill.currency`.
- `sortMonthItems(items, period, today)` y `defaultPaidOn(bill, period, today)`.
- `scoreCandidate(bill, expense)`: el nombre se normaliza (NFD sin diacríticos, lowercase) y se busca con `includes` en la descripción **o** en la entidad (+30 una sola vez). Monto: `|e − b| ≤ 0.2·b`.
- `candidateWindow(period) → {from, to}` y `rankLinkCandidates(bill, period, expenses(+linked?))`, que filtra ventana y `linked`, ordena por score desc y después por `|spentOn − dueDateFor|` asc, con `suggested = índice < 3 && score ≥ 50`.

### Server Actions (`src/lib/actions/fixed-bills.ts`, stub con firmas)
- `ActionResult<T> = ({ok:true} & T) | {ok:false; error:string}`.
- `createFixedBill(input: FixedBillInput) → {ok:true, id}`. `FixedBillInput = {name, emoji?, amount: string, currency?, categoryId?: string|null ("" = ninguna), paymentMethod?, dueDay?: string|number|null ("" = ninguno)}`. Hace trim del nombre (1..60). El monto se parsea con `parseAmountToCents` y tiene que ser >0. `dueDay` entero 1..31. La categoría tiene que existir con `teamId = team.id` y `kind = "expense"`. Moneda: la del input si está en `team.currencies`, si no `team.primaryCurrency`. Emoji default "🧾". Forma de pago default "debito". Ignora `userId`/`teamId` del input.
- `updateFixedBill(id, input)`, `setFixedBillActive(id, active)`, `deleteFixedBill(id)`.
- `markFixedBillPaid({billId, period, amount, paidOn, createExpense})`. `period` acepta `"YYYY-MM-01"` o `"YYYY-MM"` y se guarda como día 1. El pago guarda `currency = bill.currency`.
- `linkFixedBillExpense({billId, period, expenseId})`: el gasto tiene que ser de `team.id`. Monto y moneda del gasto, `paidOn = spentOn`.
- `unmarkFixedBillPaid({billId, period})`: no toca `expenses`.
- **Mensajes textuales**: `"Fijo no encontrado"` (siempre que el fijo no sea de `team.id` + `user.id`; **verificar el fijo antes que cualquier otra cosa**, incluido el gasto en link), `"Ya está marcado como pagado"` (UNIQUE bill/period, también en link) y `"Ese gasto ya está vinculado a otro fijo"` (UNIQUE expense_id). Los demás errores solo tienen que ser strings no vacíos.
- **Aislamiento**: ante un fijo ajeno, ninguna escritura con filas afectadas (el test compara el snapshot completo de la DB y las escrituras con count > 0).
- Revalidan `/movimientos/fijos`. Las que crean gasto revalidan además `/`, `/movimientos`, `/analytics` y `/esfuerzo`.
- **Atomicidad (CA10/CA11)**: `@/db` es **neon-http y no soporta `db.transaction`** (tira "No transactions support in neon-http driver", y el FakeDb lo imita). Hay que resolverlo con compensación (por ejemplo: insertar el gasto con `insertExpense`, insertar el pago y, si falla, borrar el gasto) o con `db.batch`. Los conflictos llegan como `DrizzleQueryError` con `cause.code === "23505"` y `cause.constraint` = nombre del índice: hay que mirar `err.cause`, no `err.code`. Bajo concurrencia, el perdedor tiene que devolver el mensaje de unicidad y dejar 0 gastos huérfanos.

### Queries (`src/lib/fixed-bills-queries.ts`, server-only, stub)
- `listFixedBillsForMonth(teamId, userId, period) → {bill, payment|null}[]`: solo los fijos que aplican (billAppliesTo) y el pago **de ese período**.
- `listLinkCandidates(teamId, userId, billId, period) → RankedCandidate[]`. **Cambio respecto de la spec**: suma `userId` para validar que el fijo sea del usuario (si no, devuelve `[]`). La ventana sale de `candidateWindow` y excluye los gastos con pago vinculado.

### MovimientosTabs (`src/components/movimientos-tabs.tsx`)
- Exportar `MOVIMIENTOS_TABS: {href, label}[]` (exactamente Gastos `/movimientos`, Ingresos `/movimientos/ingresos`, Fijos `/movimientos/fijos`) e `isMovimientosTabActive(href, pathname)`, y usarlos en el render.

### Límites del FakeDb (`src/test/fake-db.ts`)
Soporta el query builder core: `select(fields?)`/`from`/`innerJoin`/`leftJoin`/`where`/`limit` (`orderBy` se ignora), `insert().values().onConflictDoNothing().returning()`, `update().set().where().returning()`, `delete().where().returning()` y `batch`. Condiciones: `eq, ne, lt/lte/gt/gte, isNull/isNotNull, inArray/notInArray, between, and, or, not`. **No** soporta `db.query.*` (relational API), `db.execute`, `groupBy`, subqueries/`exists`, `lower/ilike` ni campos SQL calculados en el select: tira un error explícito en vez de dar un falso verde. Si el builder necesita algo más, puede extender el fake **sin** relajar las validaciones.

## Stubs creados
- `src/lib/fixed-bills.ts`: tipos y firmas; cada función tira `"no implementado (stub TDD)"`.
- `src/lib/actions/fixed-bills.ts`: `"use server"` y firmas de las 7 actions; tiran error.
- `src/lib/fixed-bills-queries.ts`: firmas de `listFixedBillsForMonth` y `listLinkCandidates`; tiran error.
- Infra de test (no es producción): `vitest.config.ts`, `src/test/server-only-stub.ts`, `src/test/fake-db.ts` (+ `fake-db.test.ts`, verde) y `src/test/fixed-bills-fixtures.ts`.
- `package.json`: `"test": "vitest run"` y devDependency `vitest ~4.0.18` (también cambió `package-lock.json`).
- No se tocaron `src/db/schema.ts` ni `movimientos-tabs.tsx`: los tests fallan porque faltan esos exports.
