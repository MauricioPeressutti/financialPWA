# Endpoint para listar los usuarios de la app (admin)

## Contexto
Pedido: "Creame un endpoint que me permita enlistar todos los usuarios de esta app".

Qué hay hoy:
- `users` (src/db/schema.ts:71) es el espejo de Firebase Auth: `id` (uuid), `firebase_uid`, `email`, `display_name`, `photo_url`, `created_at`. La membresía está en `team_members` (`team_id`, `user_id`, `role`, `declared_income_cents`...). Hay datos sensibles relacionados en `telegram_links` (`code`, `telegram_user_id`, `telegram_chat_id`).
- `/api/uso` (src/app/api/uso/route.ts) es una vista HTML local, git-ignored, **sin auth**, que devuelve 404 si `NODE_ENV === "production"`. Ya lista usuarios con métricas de uso. No sirve como endpoint: no está versionada, no existe en prod y es HTML.
- `src/proxy.ts`: el matcher `/((?!api/|_next/|__/|healthz|.*\.[\w]+$).*)` **excluye todo `/api/*`**. El proxy no protege este endpoint: toda la autorización tiene que estar en el route handler.
- El patrón de auth por secreto que ya existe es `src/app/api/cron/card-reminders/route.ts` (`Authorization: Bearer <CRON_SECRET>`). Ese route también acepta solo el header `x-vercel-cron`, que se puede falsificar: **no copiar esa parte**.
- Auth de usuario: `getCurrentUser()` / `requireTeam()` / `assertMembership()` en src/lib/auth.ts (cookie de sesión de Firebase).
- No hay test runner (package.json solo tiene `lint` y `build`).

Decisión propuesta (ver P1): es un endpoint **de administración**, protegido por un secreto en una env var. Es el único modelo que cumple "todos los usuarios". "Solo los miembros de mi team" es otra feature; ya está cubierta en parte por la pantalla Equipo.

## Alcance
Entra:
- `GET /api/admin/users`: devuelve JSON con la lista paginada de usuarios.
- Auth por `Authorization: Bearer <ADMIN_API_SECRET>` (nueva env var). Si falta la env var, el endpoint queda **apagado** (fail-closed).
- Un set mínimo de campos (whitelist explícita), paginación con `limit`/`offset` y el total.
- Lógica pura (chequeo del secreto, parseo de paginación, mapeo de filas a DTO) en `src/lib/admin/users.ts`, para poder testearla sin DB.
- Documentar `ADMIN_API_SECRET` en `.env.example`, si el archivo existe.

NO entra:
- UI o página de admin.
- Búsqueda, filtros u ordenamientos configurables.
- Métricas de uso (gastos, ingresos, Telegram): eso sigue en `/api/uso`.
- Roles de admin en la DB, o admin por email o por Firebase custom claims.
- Modificar o borrar usuarios (solo lectura).
- Tocar `src/proxy.ts`, `/api/uso` o el route de cron.
- Rate limiting (ver Riesgos).

## Contrato
`GET /api/admin/users?limit=<1..100, default 50>&offset=<>=0, default 0>`

Respuesta 200:
```json
{
  "users": [
    { "id": "uuid", "email": "a@b.com", "displayName": "Ana" | null,
      "createdAt": "ISO-8601", "teamCount": 2 }
  ],
  "total": 37, "limit": 50, "offset": 0
}
```
Orden: `created_at desc, id desc` (estable entre páginas).

Campos que **nunca** se exponen: `firebase_uid`, `photo_url`, cualquier columna de `telegram_links` (`code`, `telegram_user_id`, `telegram_chat_id`), `declared_income_*`, cookies, tokens y montos.

Headers: `Cache-Control: no-store` en todas las respuestas, incluidas las de error.

## Criterios de aceptación
- [ ] CA1: Dado que `ADMIN_API_SECRET` no está definida o está vacía, cuando se llama a `GET /api/admin/users` (con o sin header), entonces responde 404 y no consulta la DB.
- [ ] CA2: Dado que `ADMIN_API_SECRET` está definida, cuando la request no trae `Authorization`, entonces responde 401 con `{"error":"unauthorized"}` y no consulta la DB.
- [ ] CA3: Dado que el secreto está definido, cuando el header es `Bearer <otro valor>`, otro esquema (`Basic ...`), o el secreto sin el prefijo `Bearer `, entonces responde 401.
- [ ] CA4: Dada una request con una cookie de sesión válida de un usuario común (owner de un team) y sin el Bearer, entonces responde 401. Estar logueado no da acceso.
- [ ] CA5: Dada una request con solo el header `x-vercel-cron` (o cualquier otro header) y sin el Bearer correcto, entonces responde 401.
- [ ] CA6: La comparación del secreto usa una función de tiempo constante (`crypto.timingSafeEqual` sobre buffers del mismo largo, sin cortar antes cuando los largos difieren). Se verifica con un test unitario de `isAuthorizedAdmin(header, secret)`: casos válido, inválido, largo distinto, null y vacío.
- [ ] CA7: Dado un Bearer correcto y N usuarios en la DB, cuando se llama sin query params, entonces responde 200 con `limit=50`, `offset=0`, `total=N` y como mucho 50 usuarios, ordenados por `createdAt` desc.
- [ ] CA8: Cada objeto de `users` tiene **exactamente** las claves `id`, `email`, `displayName`, `createdAt`, `teamCount`. El test compara las claves con igualdad estricta y verifica que no aparezcan `firebaseUid`, `photoUrl` ni `telegram*`.
- [ ] CA9: `teamCount` es la cantidad de filas de `team_members` del usuario (0 si no tiene team). `createdAt` es un string ISO-8601.
- [ ] CA10: Paginación: con `limit=2&offset=2` sobre 5 usuarios devuelve los usuarios 3 y 4 del orden. Con `offset >= total` devuelve `users: []` y el `total` correcto.
- [ ] CA11: Validación: `limit` no numérico, `<1` o `>100`, u `offset` negativo o no entero, responde 400 con `{"error":"invalid_pagination"}`. La DB no se consulta. No hay clamp silencioso.
- [ ] CA12: Todas las respuestas (200, 400, 401, 404) llevan `Cache-Control: no-store`.
- [ ] CA13: Los métodos distintos de GET (POST, DELETE...) responden 405. Esto es comportamiento por defecto de Next al exportar solo `GET`.
- [ ] CA14: Si falla la DB, responde 500 con `{"error":"internal"}`, sin stack ni mensaje de la DB en el body.
- [ ] CA15: El route exporta `runtime = "nodejs"` y `dynamic = "force-dynamic"`, y no se cachea ni se prerenderiza en `next build`.
- [ ] CA16: `npm run lint` y `npm run build` pasan.

CA1-CA3, CA5, CA6, CA8 (mapeo) y CA11 se testean como unit tests de `src/lib/admin/users.ts` y del handler, con la DB mockeada. CA7, CA9 y CA10 necesitan la DB (Neon branch de test) o un mock del query builder.

## Archivos/módulos afectados
- `src/app/api/admin/users/route.ts` (nuevo): el handler GET.
- `src/lib/admin/users.ts` (nuevo): `isAuthorizedAdmin`, `parsePagination`, `toUserDTO` y la query Drizzle (`users` left join count de `team_members`).
- `.env.example` (si existe): agregar `ADMIN_API_SECRET=`.
- Tests: depende de P3 (por ejemplo `src/lib/admin/users.test.ts`).
- Se usan sin modificar: `src/db/index.ts`, `src/db/schema.ts`.

## Tiene UI: no

## Riesgos
- **Exposición de PII** (emails de todos los usuarios): si se filtra el secreto, se filtra la base de usuarios. Mitigaciones: fail-closed sin env var, whitelist de campos, `no-store`, secreto largo (>=32 bytes aleatorios) y rotable desde Vercel. El secreto no se loguea, y la ruta tampoco loguea emails.
- **El proxy no cubre `/api/*`**: si alguien quita el chequeo del handler, la ruta queda pública. Los tests CA1-CA5 son la red de seguridad.
- **Sin rate limiting**: un secreto largo hace inviable la fuerza bruta, pero no hay límite de intentos. Se acepta con costo $0; Vercel no da rate limit gratis por ruta.
- **Antipatrón existente**: el cron acepta `x-vercel-cron` sin secreto. No es parte de esta feature, pero conviene arreglarlo aparte.
- **Costo**: `count` de `team_members` con un join por página. Con la escala actual (decenas de usuarios) es despreciable en Neon free.
- **Deploy**: hay que setear `ADMIN_API_SECRET` en Vercel. Lo hace el usuario: Claude no corre deploys ni cambia env vars de prod.

## Preguntas abiertas
- **P1 (BLOQUEANTE, con default propuesto)**: ¿quién consume el endpoint? La spec asume **vos como admin, vía secreto** (curl o script). Si en cambio querés que **cada usuario logueado vea a los miembros de sus teams**, cambian la auth (cookie + `assertMembership`), el alcance (no son "todos") y probablemente la ruta. Si no hay respuesta, se sigue con el default.
- P2 (no bloqueante): ¿incluir `photoUrl` o el último movimiento (`lastActivityAt`)? Por defecto no (mínimo necesario).
- P3 (no bloqueante, pero define cómo se verifican los CA): no hay test runner. Propuesta: agregar `vitest` como devDependency, con un script `npm test` y sin costo. Sin runner, los CA quedan verificados solo con lint, build y curl manual.
- P4 (no bloqueante): ¿alcanza con `limit`/`offset`, o preferís paginación por cursor? Con pocos usuarios, offset es suficiente.
