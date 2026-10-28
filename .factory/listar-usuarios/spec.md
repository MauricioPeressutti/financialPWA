# Listado de usuarios de la app (admin): pantalla + endpoint

## Contexto
Pedido original: "Creame un endpoint que me permita enlistar todos los usuarios de esta app". En el checkpoint el usuario agregó: "Armame la ui y probalo". Ahora la feature es una **pantalla de admin** dentro de la app, más el endpoint (ver P1) y tests. El usuario no respondió P1-P4 de la versión anterior, así que se toman los defaults: acceso solo para el admin/dueño, sin campos extra, vitest como runner y paginación por offset.

Qué hay hoy:
- `users` (src/db/schema.ts) es el espejo de Firebase Auth: `id`, `firebase_uid`, `email`, `display_name`, `photo_url`, `created_at`. La membresía está en `team_members`. Hay datos sensibles relacionados en `telegram_links`.
- Login: solo Google (`src/lib/firebase/client.ts`, `GoogleAuthProvider`). Google verifica el email, así que nadie puede crear una cuenta con el email de otro. Esto hace viable una allowlist por email.
- Sesión: JWT propio en cookie (`verifySessionCookie` en src/lib/firebase/admin.ts). En server components y actions se lee con `getCurrentUser()` (src/lib/auth.ts), que está cacheada por request y devuelve la fila de `users` o null.
- `src/proxy.ts` solo mira si **existe** la cookie. Sin cookie, redirige cualquier ruta no pública (excepto `/api/*`) a `/sign-in?next=<path>`. No verifica la firma. La verificación real queda en cada página o handler.
- `src/app/(app)/layout.tsx` llama a `getCurrentUser()`, redirige a `/sign-in` si no hay usuario y a `/bienvenida` si no tiene equipo, y envuelve todo en `AppShell`.
- `AppShell` (src/components/app-shell.tsx) tiene un bottom nav con hasta 8 ítems (`max-w-lg`, pensado para mobile) y un dropdown de cuenta (email, cambiar equipo, cerrar sesión).
- Estilo de los listados (Movimientos, src/app/(app)/movimientos/page.tsx): `h1.text-xl.font-semibold`, contenedor `space-y-4`, una banda resumen `rounded-lg bg-muted px-3 py-2 text-sm`, una lista `divide-y` con filas `py-2.5 text-sm`, texto secundario `text-xs text-muted-foreground` y un estado vacío `py-6 text-center text-sm text-muted-foreground`. Componentes UI disponibles: `src/components/ui/{button,card,badge,table,...}`.
- Hay un `loading.tsx` genérico en `(app)`. No hay `error.tsx` ni `not-found.tsx` en ninguna parte (se usa el default de Next).
- `/api/uso` es una vista local git-ignored, sin auth, que da 404 en producción. No se toca.
- No hay test runner (package.json solo tiene `lint` y `build`). Tampoco hay Playwright.

### Cómo se autoriza la UI (decisión)
La página **no** llama al endpoint y el navegador **nunca** recibe `ADMIN_API_SECRET`. El esquema:
1. Nueva env var server-only `ADMIN_EMAILS`: lista de emails separados por coma. Se compara con trim y en minúsculas. Si está vacía o no existe, nadie es admin (fail-closed).
2. Helper `isAdminEmail(email, raw)` (puro) y `getAdminUser()` (server-only) en `src/lib/admin/users.ts`. `getAdminUser()` usa `getCurrentUser()` y devuelve el usuario si su email está en la allowlist, o null.
3. La página es un **Server Component**. Llama a `getAdminUser()`; si da null, llama a `notFound()`. Si no, lee la DB directo con la misma función `listUsers({limit, offset})` que usa el endpoint. Al cliente solo llega el HTML/RSC con los campos de la whitelist.
4. No se agregan roles en la DB ni custom claims.

## Alcance
Entra:
- **Página** `/admin/usuarios` (`src/app/(app)/admin/usuarios/page.tsx`), dentro del grupo `(app)` para heredar `AppShell` y el chequeo de sesión del layout.
- **Navegación**: la página **no** va al bottom nav, que ya está saturado y lo ven todos. Se agrega un ítem "Usuarios" (ícono `Shield` o `Users` de lucide) en el dropdown de cuenta de `AppShell`, entre el email y "Cerrar sesión". Solo se renderiza si el layout pasa `isAdmin: true`. El layout calcula `isAdmin` en el servidor con `isAdminEmail`. Al cliente le llega solo el booleano, nunca la lista de emails.
- **Lógica compartida** en `src/lib/admin/users.ts`: `isAuthorizedAdmin` (Bearer), `isAdminEmail`, `getAdminUser`, `parsePagination`, `toUserDTO` y `listUsers` (query Drizzle).
- **Endpoint** `GET /api/admin/users` con Bearer `ADMIN_API_SECRET`. Se mantiene por defecto para scripts y curl (ver P1). Usa la misma `listUsers`.
- **Tests** con vitest (`npm test`): unitarios de la lógica pura, del handler y del gating de la página, con la DB y la sesión mockeadas.
- **Verificación manual en navegador** (desktop y viewport mobile).
- Documentar `ADMIN_EMAILS` y `ADMIN_API_SECRET` en `.env.example` si el archivo existe, y si no, en el README o el lugar donde estén documentadas las otras env vars.

NO entra:
- Búsqueda, filtros u orden configurable.
- Métricas de uso, foto o última actividad (siguen en `/api/uso`).
- Editar, borrar, impersonar o invitar usuarios (solo lectura).
- Roles de admin en la DB o custom claims de Firebase.
- Tocar `src/proxy.ts`, `/api/uso` o el route de cron.
- Rate limiting.
- Tests E2E con Playwright (habría que sumar una dependencia y un browser en CI; ver P3).

## Contrato de datos (compartido UI y endpoint)
`listUsers({ limit, offset })` devuelve `{ users: UserDTO[], total, limit, offset }`.
- `UserDTO` = `{ id, email, displayName: string | null, createdAt: string (ISO-8601), teamCount: number }`.
- Orden: `created_at desc, id desc` (estable entre páginas).
- Campos que **nunca** se exponen (ni en JSON ni en el HTML/RSC de la página): `firebase_uid`, `photo_url`, columnas de `telegram_links`, `declared_income_*`, tokens y montos.

Endpoint: `GET /api/admin/users?limit=<1..100, default 50>&offset=<entero >=0, default 0>`. Responde JSON con ese mismo shape y `Cache-Control: no-store` en todas las respuestas.

Página: `GET /admin/usuarios?offset=<n>`. Tamaño de página fijo de 50 (`limit` no se expone en la UI). En la UI, un `offset` inválido (no entero, negativo) se trata como 0, sin error. Esto es distinto del endpoint, que responde 400.

## UI: comportamiento y estados
- **Encabezado**: `h1` "Usuarios" y debajo una banda resumen estilo Movimientos: "`{total}` usuarios · mostrando `{offset+1}`–`{offset+users.length}`".
- **Lista**: `divide-y`, una fila por usuario.
  - Línea 1: `displayName` o, si es null, "Sin nombre" en `text-muted-foreground`. Va truncado.
  - Línea 2 (`text-xs text-muted-foreground`): email (truncado, `break-all` o `truncate`, sin overflow horizontal) · fecha de alta con el formateador existente de `src/lib/datetime`.
  - A la derecha: `Badge` con "`{teamCount}` equipo(s)", o "Sin equipo" si es 0.
  - No se usa `<table>`: en 360px de ancho una tabla de 4 columnas desborda. Lista apilada como Movimientos.
- **Cargando**: `src/app/(app)/admin/usuarios/loading.tsx` con un skeleton de lista (título y 5 o 6 filas `h-12 rounded-lg bg-muted animate-pulse`, `aria-busy="true"`).
- **Vacío**: si `total === 0`, "Todavía no hay usuarios." Si `offset >= total > 0`, "No hay más usuarios en esta página." más un link "Volver al inicio" a `/admin/usuarios`. En los dos casos se usa el estilo de estado vacío existente.
- **Error**: `src/app/(app)/admin/usuarios/error.tsx` (client component, como pide Next). Muestra "No se pudieron cargar los usuarios." y un botón "Reintentar" que llama a `reset()` (o a la API de retry que documente la versión de Next instalada). No muestra `error.message` ni el stack.
- **Paginación**: abajo de la lista, `Button` "Anterior" y "Siguiente" como `<Link>` a `?offset=`. "Anterior" se deshabilita (o no se renderiza como link) si `offset === 0`. "Siguiente" se deshabilita si `offset + limit >= total`. Si `total <= 50`, no se muestra la paginación.
- **Responsive**: entra en el contenedor `max-w-lg` de `AppShell`, sin scroll horizontal a 360px y con área táctil de los botones >= 40px de alto. No queda tapada por el bottom nav (eso ya lo resuelve el padding de `main`).
- **Metadata**: `robots: { index: false }` en la página.
- **Render dinámico**: la página depende de cookies, así que no se prerenderiza. Hay que confirmar en `next build` que figure como dinámica (ƒ).

## Criterios de aceptación

### Lógica compartida (`src/lib/admin/users.ts`)
- [ ] CA1: `isAdminEmail(email, raw)`: devuelve true si el email está en la lista (sin distinguir mayúsculas y tolerando espacios, por ejemplo `" A@B.com , c@d.com"` admite `a@b.com`). Devuelve false si `raw` es undefined, `""` o `" , "`, si `email` es null o vacío, o si el email es solo un prefijo o sufijo de uno de la lista (`a@b.co` contra `a@b.com`). Se testea con unit test.
- [ ] CA2: `isAuthorizedAdmin(header, secret)` compara en tiempo constante (`crypto.timingSafeEqual` sobre buffers del mismo largo, sin cortar antes si los largos difieren). Unit test con los casos válido, inválido, largo distinto, header null, secreto vacío, esquema `Basic` y secreto sin el prefijo `Bearer `.
- [ ] CA3: `parsePagination`: sin params da `{limit:50, offset:0}`. `limit` no numérico, `<1`, `>100` o no entero, u `offset` negativo o no entero, dan un error tipado (sin clamp silencioso). Unit test.
- [ ] CA4: `toUserDTO` devuelve un objeto con **exactamente** las claves `id`, `email`, `displayName`, `createdAt`, `teamCount`. `createdAt` es un string ISO-8601 y `teamCount` es un número. El test compara las claves con igualdad estricta, partiendo de una fila que trae también `firebaseUid` y `photoUrl`.
- [ ] CA5: `listUsers` ordena por `created_at desc, id desc`. `teamCount` cuenta las filas de `team_members` (0 si el usuario no tiene equipo). Con `limit=2&offset=2` sobre 5 usuarios devuelve el 3.º y el 4.º, y con `offset >= total` devuelve `users: []` con el `total` correcto. Se verifica con un mock del query builder o contra un branch de test de Neon (ver P5).

### Página `/admin/usuarios`: acceso
- [ ] CA6: Dado `ADMIN_EMAILS` con el email del usuario logueado, cuando entra a `/admin/usuarios`, ve el listado (status 200). Test del server component con `getCurrentUser` y `listUsers` mockeados: renderiza y no llama a `notFound`.
- [ ] CA7: Dado un usuario logueado cuyo email **no** está en `ADMIN_EMAILS`, la página llama a `notFound()` (respuesta 404) y **no** llama a `listUsers`. Test unitario con mocks.
- [ ] CA8: Dado que `ADMIN_EMAILS` no está definida o está vacía, un usuario logueado (cualquiera) recibe 404 y no se consulta la DB de usuarios.
- [ ] CA9: Sin cookie de sesión, `GET /admin/usuarios` redirige a `/sign-in?next=%2Fadmin%2Fusuarios`. Esto lo hace el proxy, el mismo comportamiento que cualquier ruta privada, así que no revela que la página existe. Con una cookie inválida o vencida, el layout redirige a `/sign-in`. Se verifica manualmente (CA22) y, si es viable, con un unit test de `proxy()`.
- [ ] CA10: La respuesta 404 para no-admins es indistinguible de una ruta inexistente: el mismo componente not-found y sin texto que mencione "admin" o "usuarios". Verificación manual comparando con `/ruta-que-no-existe`.
- [ ] CA11: El ítem "Usuarios" del dropdown de cuenta aparece solo si el layout calcula `isAdmin === true`. Test: `AppShell` con `isAdmin=false` no renderiza el link a `/admin/usuarios`, y con `true` sí lo renderiza. El bottom nav no cambia.
- [ ] CA12: Ni la lista `ADMIN_EMAILS` ni `ADMIN_API_SECRET` llegan al cliente. Ninguna de las dos lleva prefijo `NEXT_PUBLIC_`, `src/lib/admin/users.ts` importa `"server-only"`, y un grep sobre `.next/static` después del build no encuentra ningún valor de prueba de esas variables.

### Página `/admin/usuarios`: contenido y estados
- [ ] CA13: Con N <= 50 usuarios, la página muestra N filas en orden de alta descendente. Cada fila muestra el nombre (o "Sin nombre"), el email, la fecha de alta y el badge de equipos ("Sin equipo" si es 0). La banda resumen dice "N usuarios". No se muestra la paginación.
- [ ] CA14: El HTML/RSC de la página no contiene `firebase_uid`, `firebaseUid`, `photo_url`, `photoUrl` ni datos de `telegram_links`. Test: se renderiza con una fila que trae esos campos con valores centinela y se verifica que el output no los contiene.
- [ ] CA15: Con 0 usuarios se ve "Todavía no hay usuarios." y no hay paginación.
- [ ] CA16: Con 120 usuarios, `?offset=0` muestra 50 filas, "Anterior" deshabilitado y "Siguiente" con link a `?offset=50`. `?offset=100` muestra 20 filas, "Anterior" con link a `?offset=50` y "Siguiente" deshabilitado. `?offset=500` muestra el estado "No hay más usuarios en esta página." con link a `/admin/usuarios`.
- [ ] CA17: `?offset=abc` u `?offset=-5` se tratan como offset 0, sin error.
- [ ] CA18: Si `listUsers` tira un error, se renderiza `error.tsx` con "No se pudieron cargar los usuarios." y un botón "Reintentar". El mensaje del error no aparece en pantalla. Test del componente `error.tsx` con un `Error("db secret xyz")` que verifica que "xyz" no se renderiza.
- [ ] CA19: Existe `loading.tsx` en el segmento, con `aria-busy="true"`.

### Endpoint `GET /api/admin/users` (si se mantiene; ver P1)
- [ ] CA20: Si `ADMIN_API_SECRET` no está o está vacía, responde 404 y no consulta la DB. Sin header `Authorization`, o con un Bearer incorrecto, otro esquema, solo `x-vercel-cron` o solo una cookie de sesión válida (aunque sea del admin), responde 401 con `{"error":"unauthorized"}` sin consultar la DB. Con el Bearer correcto responde 200 con el contrato y `limit=50`/`offset=0` por defecto. Con paginación inválida responde 400 `{"error":"invalid_pagination"}`. Si falla la DB responde 500 `{"error":"internal"}` sin stack. Todas las respuestas llevan `Cache-Control: no-store`. Los métodos que no son GET responden 405. El route exporta `runtime = "nodejs"` y `dynamic = "force-dynamic"`. Tests del handler con `listUsers` mockeada.

### Calidad y verificación
- [ ] CA21: `npm run lint`, `npm run build` y `npm test` (vitest, nuevo script) pasan. En el output del build, `/admin/usuarios` y `/api/admin/users` figuran como dinámicas.
- [ ] CA22 (manual, en navegador con `npm run dev` y la DB de desarrollo):
  1. Con el email propio en `ADMIN_EMAILS`, el ítem "Usuarios" aparece en el dropdown y lleva a `/admin/usuarios`, donde se ve el listado real.
  2. Con `ADMIN_EMAILS` vacía o con otro email (reiniciando dev), el ítem desaparece y `/admin/usuarios` da 404.
  3. En incógnito y sin sesión, `/admin/usuarios` redirige a `/sign-in?next=...`.
  4. En DevTools, con viewport de 360x740 (mobile), no hay scroll horizontal, los emails largos se truncan o cortan sin romper el layout y la paginación (forzable con un `limit` menor en dev, o con >50 usuarios) es usable y no queda tapada por el bottom nav.
  5. Se ve bien en tema claro y en tema oscuro (`ThemeToggle`).
  6. En Network, ninguna respuesta al navegador contiene `ADMIN_API_SECRET` ni la lista `ADMIN_EMAILS`.
  Se adjuntan capturas (desktop y mobile) o una nota con el resultado en `.factory/listar-usuarios/`.

## Archivos/módulos afectados
- `src/lib/admin/users.ts` (nuevo, `server-only`): `isAdminEmail`, `getAdminUser`, `isAuthorizedAdmin`, `parsePagination`, `toUserDTO`, `listUsers`. Conviene separar la parte pura en `src/lib/admin/users-core.ts` (sin `server-only` ni `db`) para testearla sin mocks de módulos. Lo decide el implementador.
- `src/app/(app)/admin/usuarios/page.tsx` (nuevo): server component con gating y listado.
- `src/app/(app)/admin/usuarios/loading.tsx` y `error.tsx` (nuevos).
- `src/app/(app)/layout.tsx`: calcular `isAdmin` y pasarlo a `AppShell`.
- `src/components/app-shell.tsx`: prop `isAdmin` y el ítem condicional en el dropdown.
- `src/app/api/admin/users/route.ts` (nuevo, si P1 = mantener).
- `package.json`: `vitest` (y, si hace falta para los tests de componentes, `@testing-library/react` y `jsdom`) como devDependencies, y el script `"test": "vitest run"`.
- `vitest.config.ts` (nuevo): alias `@/` a `src/`, y mock o stub de `server-only`.
- Tests: `src/lib/admin/users.test.ts`, `src/app/api/admin/users/route.test.ts`, `src/app/(app)/admin/usuarios/page.test.tsx`, `src/components/app-shell.test.tsx` (o donde convenga según la config).
- `.env.example` o la documentación de env vars: `ADMIN_EMAILS=` y `ADMIN_API_SECRET=`.
- Sin cambios: `src/proxy.ts`, `src/db/schema.ts`, `src/lib/auth.ts`, `/api/uso`.

## Tiene UI: sí

## Riesgos
- **Exposición de PII** (emails de todos los usuarios). Mitigaciones: fail-closed en las dos env vars, 404 para no-admins, whitelist de campos (CA4 y CA14), `no-store` en el endpoint y `noindex` en la página. Si se filtra la sesión del admin, se filtra la lista. Es el mismo riesgo que ya tiene su cuenta.
- **Allowlist por email**: es segura porque el único proveedor es Google (email verificado). **Si en el futuro se habilita email/password u otro proveedor sin verificación, hay que revisar esto** (exigir `email_verified` o pasar a un claim). `users.email` es el guardado en la DB: si el email del admin cambia en Google y no se resincroniza, pierde el acceso (fail-closed, aceptable).
- **El proxy solo verifica que exista la cookie**: la autorización real está en la página (`getAdminUser` y `notFound`). Si alguien la quita, la página queda abierta a cualquier logueado. CA7 y CA8 son la red de seguridad.
- **Dependencia del layout `(app)`**: si el admin no tiene equipo, el layout lo manda a `/bienvenida` antes de llegar a la página. Se acepta, porque el admin siempre tiene equipo. Si molesta, la página se mueve fuera del grupo `(app)`.
- **Cambiar el layout y `AppShell` afecta a todas las páginas**: `getCurrentUser` ya está cacheada, y `isAdminEmail` es puro y no agrega queries.
- **Nueva devDependency (vitest y testing-library)**: costo $0, pero suma tiempo de instalación. Los tests de server components async con mocks de `next/navigation` (`notFound`) pueden necesitar ajustes según la versión de Next. Hay que leer `node_modules/next/dist/docs/` antes de implementar, en particular `error.tsx` (la firma de `reset` o `retry`), `PageProps` y `notFound`.
- **El endpoint duplica una superficie de ataque** con un secreto de larga vida. Si no se usa desde scripts, conviene no exponerlo (P1).
- **Deploy**: hay que setear `ADMIN_EMAILS` (y `ADMIN_API_SECRET` si P1 = mantener) en Vercel. Lo hace el usuario, no Claude.
- Esta spec reemplaza la anterior. Antes decía "NO entra UI" y "NO admin por email": las dos cosas cambian por pedido explícito del usuario.

## Preguntas abiertas
- **P1 (no bloqueante, default: mantener)**: ¿se mantiene `GET /api/admin/users` con Bearer para scripts y curl, o alcanza con la pantalla? Recomendación: **mantenerlo**, porque fue el pedido original, comparte `listUsers` y su costo marginal es bajo. Queda **apagado** (404) mientras `ADMIN_API_SECRET` no esté seteada en Vercel, así que si no lo usás, simplemente no seteás la variable. Si preferís no tenerlo, se borran el route, CA2 y CA20.
- **P2 (no bloqueante, default: solo tu email)**: ¿qué emails van en `ADMIN_EMAILS`? Por defecto, solo el del dueño. Es configuración de deploy, no de código.
- **P3 (no bloqueante, default: no)**: ¿querés tests E2E en navegador (Playwright) además de los unitarios y la verificación manual? Por defecto no (nueva dependencia pesada). La prueba visual queda manual (CA22).
- **P4 (no bloqueante, default: no)**: ¿mostrar la foto (`photoUrl`) o la última actividad en la lista? Por defecto no (mínimo necesario).
- **P5 (no bloqueante)**: CA5 (orden, conteo y paginación reales) necesita una DB. Por defecto se usa un mock del query builder. Si querés verificarlo contra Neon, hace falta un branch de test (lo crea el usuario).

Ninguna pregunta bloquea: con los defaults se puede implementar.
