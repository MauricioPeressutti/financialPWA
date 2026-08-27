<#
  Configuracion inicial de Google Cloud para la app.
  Corre una sola vez por proyecto. Idempotente: se puede repetir sin romper nada.

  Uso:
    ./scripts/setup-gcp.ps1 -ProjectId "mi-proyecto-finanzas"
#>
param(
  [Parameter(Mandatory = $true)] [string] $ProjectId,
  [string] $Region  = "southamerica-east1",   # Sao Paulo, lo mas cerca de AR con Cloud SQL
  [string] $Service = "finanzas"
)

$ErrorActionPreference = "Stop"

Write-Host "==> Proyecto activo: $ProjectId"
gcloud config set project $ProjectId

Write-Host "==> Habilitando APIs (puede tardar 1-2 min)..."
gcloud services enable `
  run.googleapis.com `
  artifactregistry.googleapis.com `
  cloudbuild.googleapis.com `
  sqladmin.googleapis.com `
  secretmanager.googleapis.com `
  identitytoolkit.googleapis.com

Write-Host "==> Region por defecto para Cloud Run: $Region"
gcloud config set run/region $Region

Write-Host ""
Write-Host "Listo. Ahora podes deployar con:"
Write-Host "  ./scripts/deploy.ps1 -ProjectId $ProjectId"
