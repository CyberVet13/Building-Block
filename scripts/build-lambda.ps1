param([switch]$LayerOnly, [switch]$SrcOnly)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ApiDir   = Join-Path $Root "apps\api"
$SrcDir   = Join-Path $ApiDir "src"
$ReqFile  = Join-Path $ApiDir "requirements.txt"
$DistDir  = Join-Path $Root "dist"
$LayerDir = Join-Path $DistDir "lambda-layer"
$LayerPkg = Join-Path $LayerDir "python\lib\python3.12\site-packages"
$SrcZip   = Join-Path $DistDir "lambda-src.zip"
New-Item -ItemType Directory -Force -Path $DistDir | Out-Null

if (-not $SrcOnly) {
    Write-Host "==> Installing dependencies into Lambda layer..."
    if (Test-Path $LayerDir) { Remove-Item -Recurse -Force $LayerDir }
    New-Item -ItemType Directory -Force -Path $LayerPkg | Out-Null
    $pipArgs = @("install", "--requirement", $ReqFile, "--target", $LayerPkg,
                 "--platform", "manylinux2014_x86_64", "--implementation", "cp",
                 "--python-version", "3.12", "--only-binary", ":all:", "--upgrade", "--quiet")
    py -3.12 -m pip @pipArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Retrying without platform constraint (local dev)..." -ForegroundColor Yellow
        $pipArgsDev = @("install", "--requirement", $ReqFile, "--target", $LayerPkg, "--upgrade", "--quiet")
        py -3.12 -m pip @pipArgsDev
    }
    Write-Host "  Layer ready: $LayerDir" -ForegroundColor Green
}

if (-not $LayerOnly) {
    Write-Host "==> Zipping source code..."
    if (Test-Path $SrcZip) { Remove-Item -Force $SrcZip }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::Open($SrcZip, "Create")
    Get-ChildItem -Recurse -File $SrcDir | ForEach-Object {
        $rel = $_.FullName.Substring($SrcDir.Length + 1)
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, "Optimal") | Out-Null
    }
    $zip.Dispose()
    Write-Host "  Source zip ready: $SrcZip" -ForegroundColor Green
}

Write-Host "Done. CDK will use dist/ artifacts." -ForegroundColor Cyan
