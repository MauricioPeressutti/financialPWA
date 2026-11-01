# Build log: gastos-fijos

## Intento 1
- Cambios:
  - `src/db/schema.ts`: tablas `fixedBills` y `fixedBillPayments` (con `currency` en payments), índice `fixed_bills_team_user_idx(team_id, user_id)`, `uniqueIndex("fixed_bill_payments_bill_period_idx")` y `uniqueIndex("fixed_bill_payments_expense_idx").where(expense_id is not null)`. FKs: team/user cascade, category nullable, bill_id cascade, expense_id set null. Tipos `FixedBill` y `FixedBillPayment`.
  - `drizzle/0018_fixed_bills.sql` y `drizzle/meta/0018_snapshot.json` + `_journal.json`: generados con `npm run db:generate -- --name fixed_bills`. **No se aplicó contra ninguna DB.** drizzle-kit también incluyó `ALTER TYPE payment_method ADD VALUE 'transferencia'`, porque el snapshot no tenía ese valor (se había agregado a mano con `drizzle/payment-method-transferencia.sql`). Lo cambié a `ADD VALUE IF NOT EXISTS` para que no falle en DBs que ya lo tienen.
  - `src/lib/fixed-bills.ts`: lógica pura completa. Agregué el helper `normalizePeriod` (devuelve null si el período es inválido) para que las actions rechacen un período inválido en vez de caer al mes actual.
  - `src/lib/fixed-bills-queries.ts`: `listFixedBillsForMonth` (leftJoin al pago del período + `billAppliesTo`) y `listLinkCandidates(teamId, userId, billId, period)`. Helpers nuevos para la página: `listWindowExpenses` (los gastos de la ventana con su flag `linked`, en una sola consulta; la página rankea cada fijo en el cliente con `rankLinkCandidates`), `listUserFixedBills` y `getCategoryNames`.
  - `src/lib/validation.ts`: esquema zod `fixedBillInput` (trim y largo de 1 a 60 en el nombre, categoría uuid o vacía, forma de pago del enum, `dueDay` entero de 1 a 31 o vacío). El strip de zod descarta `userId`/`teamId`.
  - `src/lib/actions/fixed-bills.ts`: las 7 actions. Todas verifican primero el fijo por `id + team.id + user.id` y, si no coincide, devuelven "Fijo no encontrado". La atomicidad se resuelve por compensación, sin `db.transaction`: primero se inserta el pago, así el UNIQUE(bill, period) frena el doble marcado antes de crear un gasto; después `insertExpense` y por último el update del vínculo. Si falla un paso, se borran el gasto y el pago. Los conflictos se leen de `err.cause.code === "23505"` y `cause.constraint`. El gasto creado usa `fxForMovement` para la moneda del fijo, igual que `createExpense`.
  - `src/components/movimientos-tabs.tsx`: exports `MOVIMIENTOS_TABS` e `isMovimientosTabActive`, y tercer tab "Fijos".
  - `src/app/(app)/movimientos/fijos/page.tsx` y `loading.tsx`: la pantalla y su skeleton. El `?mes` mayor a `maxSelectablePeriod` se recorta a ese mes.
  - `src/components/fijos/`: `fixed-bill-form.tsx` (Dialog de alta y edición con Archivar/Reactivar y Eliminar con confirmación inline; `NewFixedBillButton`), `mark-paid-dialog.tsx`, `link-expense-dialog.tsx`, `fixed-bill-row.tsx` (fila + `ArchivedBillRow`) y `month-picker.tsx`. Los botones de acción tienen `h-10` o `size-10` (40px), las acciones bajan a una segunda línea con `flex-wrap` y los diálogos usan `max-h-[calc(100dvh-2rem)] overflow-y-auto`.
- Tests locales: **122 pasan / 0 fallan** (`npm test`, 6 archivos).
- `npx tsc --noEmit`: OK (antes corrí `npx next typegen` para generar el `PageProps` de la ruta nueva).
- `npm run lint`: 5 problemas (3 errores y 2 warnings), **todos preexistentes** y en archivos que no toqué: cosmic-background, theme-toggle, expense-form, income-form y payment-methods. Ninguno en archivos de esta feature.
- `npm run build`: OK, `/movimientos/fijos` aparece como ruta dinámica.
- Notas / dudas:
  - No se modificó ningún test ni `src/test/*`. No encontré tests incorrectos.
  - Agregué algo que la spec no lista explícitamente: una sección colapsable "Archivados (n)" al pie de la página. Sin ella, un fijo archivado no aparece en ningún mes sin pago y no habría forma de reactivarlo (la spec pide `setFixedBillActive` para archivar o reactivar).
  - "Desmarcar" se ejecuta directo desde el menú, sin confirmación. Si había un gasto vinculado, el toast avisa que el gasto sigue en Movimientos (P3).
  - La FK `fixed_bills.category_id` quedó como `ON DELETE no action`, igual que `expenses.category_id`, porque la spec no pide otra cosa.
  - Migración: `0018` choca con la rama de Cuotas (también 0018). Hay que regenerar con el número libre al mergear la segunda. Falta aplicarla en dev (CA26) y en prod; lo decide y lo corre el usuario.
  - Quedan pendientes de verificación manual: CA18 a CA25 (navegador y mobile 360/402) y CA28 (capturas).
