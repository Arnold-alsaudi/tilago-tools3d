# Tilago Rebrand - installer (run once per computer)
# Copies the panel into the user's CEP extensions folder. After that the panel updates itself
# from GitHub every time it opens, so this never has to be run again.
$ErrorActionPreference = 'Stop'
$src  = Join-Path $PSScriptRoot 'panel'
$dest = Join-Path $env:APPDATA 'Adobe\CEP\extensions\com.tilago.rebrand'

Write-Host ''
Write-Host '  Tilago Rebrand - Installer' -ForegroundColor Magenta
Write-Host ''

if (-not (Test-Path (Join-Path $src 'CSXS\manifest.xml'))) {
  Write-Host '  [x] panel folder not found next to install.ps1' -ForegroundColor Red
  exit 1
}
if (Get-Process -Name AfterFX -ErrorAction SilentlyContinue) {
  Write-Host '  [!] After Effects is running. Close it before installing.' -ForegroundColor Yellow
  exit 1
}

$extDir = Split-Path $dest
if (-not (Test-Path $extDir)) { New-Item -ItemType Directory -Force -Path $extDir | Out-Null }
if (Test-Path $dest) {
  $item = Get-Item $dest -Force
  if ($item.LinkType) { $item.Delete() } else { Remove-Item $dest -Recurse -Force }
}
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Path (Join-Path $src '*') -Destination $dest -Recurse -Force
Write-Host "  [ok] Installed to $dest" -ForegroundColor Green

# Unsigned panels need PlayerDebugMode for every CEP runtime version.
foreach ($v in 9..13) {
  $key = "HKCU:\Software\Adobe\CSXS.$v"
  if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
  Set-ItemProperty -Path $key -Name 'PlayerDebugMode' -Value '1' -Type String
}
Write-Host '  [ok] Enabled CEP panels (CSXS 9-13)' -ForegroundColor Green
Write-Host ''
Write-Host '  Open After Effects > Window > Extensions > Tilago Rebrand' -ForegroundColor Cyan
Write-Host '  From now on the panel updates itself from GitHub.' -ForegroundColor Cyan
Write-Host ''
