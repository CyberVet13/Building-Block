# Build-Block local development setup (Windows PowerShell)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "==> Installing web dependencies..."
Set-Location "$Root\apps\web"
npm install

Write-Host "==> Installing API dependencies..."
Set-Location "$Root\apps\api"
if (Test-Path .venv) { Remove-Item -Recurse -Force .venv }
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"

Write-Host "==> Starting Postgres (requires Docker Desktop)..."
Set-Location $Root
if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker compose up -d db
    Write-Host "Postgres running at postgresql://postgres:dev@localhost:5432/buildblock"
} else {
    Write-Host "Docker not found. Install Docker Desktop, then run: docker compose up -d db"
    Write-Host "Or install Postgres 16 + pgvector locally and run: database/schema.sql"
}

Write-Host "==> Copy env files if missing..."
if (-not (Test-Path "$Root\apps\api\.env")) {
    Copy-Item "$Root\apps\api\.env.example" "$Root\apps\api\.env"
}
if (-not (Test-Path "$Root\apps\web\.env.local")) {
    Copy-Item "$Root\apps\web\.env.example" "$Root\apps\web\.env.local"
}

Write-Host "Done. Run web: cd apps/web && npm run dev"
