# Finanzas

PWA para cargar gastos compartidos de la familia/pareja.

- **Stack:** Next.js 16 (App Router) · Tailwind v4 · shadcn/ui · Drizzle + Postgres · Firebase Auth
- **Deploy:** Google Cloud Run (ver [`DEPLOY.md`](./DEPLOY.md))

## Funcionalidad

- Cargar gastos: monto, categoría, subcategoría, forma de pago (efectivo / débito / crédito), descripción, fecha
- Reintegros por gasto (parciales o múltiples)
- Login con Google + equipos: invitás gente por link
- Dashboard: total del mes, desglose por categoría y forma de pago, neto de reintegros

## Desarrollo local

```bash
cp .env.example .env      # completar valores
npm install
npm run dev               # http://localhost:3000
```

## Roadmap

| Fase | Estado | Qué |
|------|--------|-----|
| 0 | ✅ | Scaffold + Dockerfile + deploy a Cloud Run |
| 1 | ⬜ | Firebase Auth (Google) + bootstrap de usuario |
| 2 | ⬜ | Cloud SQL + Drizzle: esquema + migraciones |
| 3 | ⬜ | Equipos: invite link + miembros |
| 4 | ⬜ | ABM categorías + CRUD gastos + reintegros |
| 5 | ⬜ | Dashboard con agregaciones y filtros |
| 6 | ⬜ | PWA: manifest + service worker + instalar |
| 7 | ⬜ | Pulido: formato ARS, timezone AR, estados vacíos |
