# Deploy en Google Cloud Run

## Arquitectura

```
Navegador / PWA  ──HTTPS──►  Cloud Run (Next.js, este repo)  ──►  Cloud SQL (Postgres, Fase 2)
                                     │
                                     └──►  Firebase Auth (login con Google, Fase 1)
```

Lo único que corre 24/7 es Cloud SQL (~USD 8/mes). Cloud Run escala a cero.

## Requisitos

- `gcloud` CLI instalado y logueado con tu cuenta: `gcloud auth login`
- Un proyecto de GCP con **billing habilitado**
- Docker **no** hace falta en local: la imagen la arma Cloud Build

## 1. Crear el proyecto (una vez)

```powershell
# Elegí un ID único (minúsculas, sin espacios)
$pid = "finanzas-familia-2026"

gcloud projects create $pid
# Vinculá una cuenta de facturación (listá las tuyas con: gcloud billing accounts list)
gcloud billing projects link $pid --billing-account XXXXXX-XXXXXX-XXXXXX
```

## 2. Configurar APIs y región (una vez)

```powershell
./scripts/setup-gcp.ps1 -ProjectId $pid
```

## 3. Deployar

```powershell
./scripts/deploy.ps1 -ProjectId $pid
```

Al terminar imprime la URL `https://finanzas-XXXX.a.run.app`. Esa URL ya es HTTPS
y sirve para instalar la PWA.

## Redeploy

Cada vez que quieras publicar cambios, repetí el paso 3. Cloud Build cachea capas
así que a partir del segundo build tarda ~1-2 min.

## Notas por fase

- **Fase 1 (Firebase Auth):** se agregan vars `NEXT_PUBLIC_FIREBASE_*` al `deploy.ps1`.
  El Admin SDK usa la service account por defecto de Cloud Run, no hace falta subir JSON.
- **Fase 2 (Cloud SQL):** se agrega `--add-cloudsql-instances` y `--set-secrets DATABASE_URL=...`
  al `deploy.ps1`, y la instancia se crea con `gcloud sql instances create`.
