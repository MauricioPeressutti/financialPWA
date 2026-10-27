# Endpoint de health check: GET /api/health

## Contexto
Hace falta un endpoint liviano para que monitores externos (uptime, Vercel, scripts) chequeen que la app responde. Stack: Next.js 16.3.3 con App Router y route handlers en `src/app/api/<ruta>/route.ts`. El proxy de auth (`src/proxy.ts`) ya deja pasar todo `/api/` en su `matcher` (`/((?!api/|_next/|__/|healthz|.*\\.[\\w]+$).*)`), así que la ruta nueva no se redirige a `/sign-in`. Desde v15, los handlers `GET` son dinámicos por defecto (docs: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`). `next.config` no activa `cacheComponents`.

## Alcance
**Entra:**
- Nuevo route handler `src/app/api/health/route.ts` que exporta `GET`.
- Respuesta `200` con body JSON exacto `{ "status": "ok" }`.
- Sin auth y sin acceso a la DB, Firebase ni variables de entorno.
- Respuesta no cacheada (`export const dynamic = "force-dynamic"` más header `Cache-Control: no-store`), para que cada request refleje que la instancia está viva.

**NO entra:**
- Chequeos de dependencias (Neon, Firebase, Telegram, Gemini). No se hace ninguna llamada a servicios externos, lo que también cuida el costo de $0.
- Info de versión, commit, uptime o timestamp en el body.
- Otros métodos HTTP (POST, HEAD explícito, etc.).
- La ruta `/healthz` (ya está excluida en el matcher, pero no existe y no se crea).
- Cambios en `src/proxy.ts`.

## Criterios de aceptación
- [ ] CA1: Dado el server corriendo, cuando se hace `GET /api/health` sin cookie de sesión, entonces responde `200` (no `307/308` a `/sign-in`).
- [ ] CA2: Dado el mismo request, entonces el header `Content-Type` contiene `application/json` y el body parseado es exactamente igual a `{ "status": "ok" }` (sin campos extra).
- [ ] CA3: Dado el mismo request, entonces la respuesta incluye `Cache-Control` con `no-store`.
- [ ] CA4: Dado que el handler no toca DB ni servicios externos, cuando se invoca la función `GET` exportada directamente en un test unitario sin variables de entorno (sin `DATABASE_URL`, sin credenciales de Firebase), entonces devuelve igual `200` con `{ status: "ok" }`.
- [ ] CA5: Dado `POST /api/health`, entonces responde `405` (comportamiento por defecto de Next con un handler que solo exporta `GET`).
- [ ] CA6: `npm run build` y `npm run lint` pasan sin errores. En la salida de build, `/api/health` aparece como ruta dinámica (`ƒ`), no estática.

## Archivos/módulos afectados
- `src/app/api/health/route.ts` (nuevo)
- Tests: hoy no hay test runner en `package.json` (no hay vitest ni jest). Ver Preguntas abiertas.

## Tiene UI: no

## Riesgos
- Si en el futuro se cambia el `matcher` de `src/proxy.ts` para dejar de excluir `api/`, el endpoint quedaría detrás de auth. CA1 lo cubre como regresión.
- Si el endpoint fuera estático (prerender en build), seguiría devolviendo "ok" aunque la función esté caída. `force-dynamic` y `no-store` lo evitan.
- No contradice decisiones anteriores: no existe `docs/decisions/`.

## Preguntas abiertas
1. **Infraestructura de tests (bloquea a medias):** el repo no tiene test runner. ¿Se agrega `vitest` como devDependency con un script `test` para CA1-CA5, o la verificación queda en un script/curl manual contra `next dev`? Propuesta por defecto: agregar `vitest` y testear el handler invocando `GET()` directamente (CA2-CA4). CA1 y CA5 se verifican con un request HTTP contra el server o simulando `proxy()` con un `NextRequest` a `/api/health`, además de chequear el `config.matcher`.
2. **Auth:** se asume que es público (lo habitual en un health check y lo que ya pasa con `/api/*`). Confirmar que no hace falta un token o secreto como en el cron.
3. **Profundidad:** ¿alcanza con "liveness" o se quiere también "readiness" (ping a Neon con `SELECT 1`)? Se asume liveness, porque un ping por cada chequeo consume horas de cómputo de Neon.
