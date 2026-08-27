<#
  Configuracion inicial de Google Cloud para la app.
  Corre una sola vez por proyecto. Idempotente: se puede repetir sin romper nada.

  Uso:
    ./scripts/setup-gcp.ps1 -ProjectId "mi-proyecto"
#>
param(
  [Parameter(Mandatory = $true)] [string] $ProjectId,
  [string] $Region  = "southamerica-east1",   # Sao Paulo, lo mas cerca de AR con Cloud SQL
  [string] $Service = "finanzas"
)

# gcloud escribe notas informativas a stderr; no las trates como error fatal.
$ErrorActionPreference = "Continue"

function Invoke-GcloudStep {
  param([string] $Label, [string[]] $GcloudArgs)
  Write-Host "==> $Label"
  & gcloud @GcloudArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo en: gcloud $($GcloudArgs -join ' ') (exit $LASTEXITCODE)"
  }
}

Invoke-GcloudStep "Proyecto activo: $ProjectId" @("config", "set", "project", $ProjectId)

Invoke-GcloudStep "Habilitando APIs (puede tardar 1-2 min)" @(
  "services", "enable",
  "run.googleapis.com",
  "artifactregistry.googleapis.com",
  "cloudbuild.googleapis.com",
  "sqladmin.googleapis.com",
  "secretmanager.googleapis.com",
  "identitytoolkit.googleapis.com"
)

Invoke-GcloudStep "Region por defecto para Cloud Run: $Region" @("config", "set", "run/region", $Region)

Write-Host ""
Write-Host "Listo. Ahora deployar con:"
Write-Host "  ./scripts/deploy.ps1 -ProjectId $ProjectId"
