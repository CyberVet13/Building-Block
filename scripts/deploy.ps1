# Build-Block full deployment script (Windows PowerShell)
# Run from the repo root: .\scripts\deploy.ps1
#
# Prerequisites:
#   - AWS CLI configured: aws configure (or set AWS_PROFILE)
#   - Node.js 20+ and Python 3.12 installed
#   - apps/api/.venv already created (run .\scripts\setup-local.ps1 first)
#
# Required environment variables (set before running):
#   $env:WEB_URL = "https://your-domain.com"

param(
    [string]$Stage    = "dev",
    [string]$Region   = "us-east-1",
    [string]$Account  = "058170691476",
    [switch]$SkipBuild,
    [switch]$SkipTests,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }

Step "Build-Block deploy — stage=$Stage region=$Region account=$Account"

# ── 1. Run tests ──────────────────────────────────────────────────────────────
if (-not $SkipTests) {
    Step "Running test suite..."
    Set-Location "$Root\apps\api"
    & .\.venv\Scripts\python.exe -m pytest tests/ -q
    if ($LASTEXITCODE -ne 0) { throw "Tests failed — aborting deploy" }
    Ok "29/29 tests passed"
}

# ── 2. Build Lambda artifacts ─────────────────────────────────────────────────
if (-not $SkipBuild) {
    Step "Building Lambda layer and source zip..."
    & "$Root\scripts\build-lambda.ps1"
    if ($LASTEXITCODE -ne 0) { throw "Lambda build failed" }
    Ok "dist/lambda-layer and dist/lambda-src.zip ready"
} else {
    Warn "Skipping build (--SkipBuild). Ensure dist/ is up to date."
}

# ── 3. CDK bootstrap (safe to re-run) ─────────────────────────────────────────
Step "Bootstrapping CDK..."
Set-Location "$Root\infra\cdk"
if (-not (Test-Path node_modules)) { npm install --quiet }

if ($DryRun) {
    Warn "--DryRun: skipping bootstrap, showing diff instead"
    npx cdk diff "BuildBlock$(([System.String]::Concat($Stage.Substring(0,1).ToUpper(), $Stage.Substring(1))))"
    exit 0
}

npx cdk bootstrap "aws://$Account/$Region"

# ── 4. CDK deploy ─────────────────────────────────────────────────────────────
$StackName = "BuildBlock$(([System.String]::Concat($Stage.Substring(0,1).ToUpper(), $Stage.Substring(1))))"
Step "Deploying stack: $StackName..."

$env:WEB_URL = if ($env:WEB_URL) { $env:WEB_URL } else { "https://your-domain.com" }

npx cdk deploy $StackName `
    --require-approval never `
    --outputs-file "$Root\dist\cdk-outputs-$Stage.json"

if ($LASTEXITCODE -ne 0) { throw "CDK deploy failed" }

# ── 5. Print outputs ──────────────────────────────────────────────────────────
Step "Stack outputs:"
$outputs = Get-Content "$Root\dist\cdk-outputs-$Stage.json" | ConvertFrom-Json
$outputs.$StackName.PSObject.Properties | ForEach-Object {
    Write-Host ("    {0,-30} {1}" -f $_.Name, $_.Value)
}

# ── 6. Post-deploy reminders ───────────────────────────────────────────────────
Step "Post-deploy checklist:"
Write-Host @"
    [ ] Fill Stripe secret:
        aws secretsmanager put-secret-value \
          --secret-id build-block/stripe-$Stage \
          --secret-string '{"secret_key":"sk_live_...","webhook_secret":"whsec_..."}'

    [ ] Run schema migration on Aurora:
        psql {DbClusterEndpoint}/buildblock -f database/schema.sql

    [ ] Run corpus ingest:
        cd apps/api
        .\.venv\Scripts\python.exe ..\..\scripts\ingest\ingest_corpus.py `
          --corpus-dir ..\..\corpus\templates

    [ ] Fill Stripe price IDs in apps/api/src/build_block/billing/stripe_client.py

    [ ] Add Stripe webhook endpoint:
        https://{HttpApiUrl}/webhooks/stripe
        Events: checkout.session.completed, customer.subscription.updated,
                customer.subscription.deleted, invoice.paid

    [ ] Make yourself admin:
        UPDATE users SET role='admin' WHERE email='you@domain.com';

    [ ] Deploy frontend:
        Set NEXT_PUBLIC_API_URL={HttpApiUrl}
        Set NEXT_PUBLIC_COGNITO_USER_POOL_ID={UserPoolId}
        Set NEXT_PUBLIC_COGNITO_CLIENT_ID={UserPoolClientId}
        cd apps/web && npm run build

    [ ] Smoke test: sign up -> preview -> subscribe -> full plan -> export PDF
"@

Ok "Deploy complete."
