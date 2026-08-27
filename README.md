# Finanzas

PWA para cargar gastos compartidos de la familia/pareja.

- **Stack:** Next.js 16 (App Router) · Tailwind v4 · shadcn/ui · Drizzle + Neon (Postgres) · Firebase Auth (Google)
- **Hosting:** Vercel (Hobby, free)
- **Costo objetivo:** $0/mes

## Funcionalidad

- Cargar gastos: monto, categoría, subcategoría, forma de pago (efectivo / débito / crédito), descripción, fecha
- Reintegros por gasto (parciales o múltiples) → neto automático
- Login con Google + equipos: invitás gente con un link
- Dashboard mensual: total, desglose por categoría y forma de pago, neto de reintegros

## Puesta en marcha

Ver [`SETUP.md`](./SETUP.md) — Neon + Firebase + Vercel, todo en free tier.

```bash
cp .env.example .env     # completar con los valores de SETUP.md
npm install
npm run db:push          # crea las tablas en Neon
npm run dev              # http://localhost:3000
```

## Estructura

```
src/
  app/
    (app)/            rutas con sesión (dashboard, gastos, categorías, equipo)
    sign-in/          login con Google
    join/[token]/     aceptar invitación
    api/auth/session/ crea/borra la cookie de sesión
    manifest.ts       PWA
  db/                 schema Drizzle + cliente Neon
  lib/
    auth.ts           sesión + helpers multi-tenant
    firebase/         client (web SDK) + admin (verificación de token)
    actions/          Server Actions (expenses, categories, team)
    queries.ts        lecturas para RSC
  proxy.ts            gate liviano de rutas por cookie
```

## Roadmap

| Fase | Estado | Qué |
|------|--------|-----|
| 0 | ✅ | Scaffold Next.js + shadcn |
| 1 | ✅ | Firebase Auth (Google) + equipos + invite link |
| 2 | ✅ | Neon + Drizzle: schema + migraciones |
| 3 | ✅ | CRUD gastos + categorías + reintegros |
| 4 | ✅ | Dashboard con agregaciones y filtros |
| 5 | ⬜ | Deploy a Vercel |
| 6 | ⬜ | PWA completa: service worker + botón instalar + iconos PNG |
| 7 | ⬜ | Pulido: timezone AR, estados vacíos, edición de categorías inline |
