<#
  Build + deploy a Cloud Run desde el codigo fuente.
  Cloud Build arma la imagen con el Dockerfile y la publica en Artifact Registry.

  Uso:
    ./scripts/deploy.ps1 -ProjectId "mi-proyecto"
#>
param(
  [Parameter(Mandatory = $true)] [string] $ProjectId,
  [string] $Region  = "southamerica-east1",
  [string] $Service = "finanzas"
)

$ErrorActionPreference = "Continue"

& gcloud config set project $ProjectId
if ($LASTEXITCODE -ne 0) { throw "No se pudo fijar el proyecto $ProjectId" }

Write-Host "==> Deploy de '$Service' a Cloud Run ($Region)..."
& gcloud run deploy $Service `
  --source . `
  --region $Region `
  --quiet `
  --port 8080 `
  --allow-unauthenticated `
  --cpu 1 `
  --memory 512Mi `
  --min-instances 0 `
  --max-instances 3 `
  --set-env-vars "NODE_ENV=production,NEXT_TELEMETRY_DISABLED=1"
if ($LASTEXITCODE -ne 0) { throw "El deploy fallo (exit $LASTEXITCODE)" }

Write-Host ""
Write-Host "==> URL del servicio:"
& gcloud run services describe $Service --region $Region --format "value(status.url)"
