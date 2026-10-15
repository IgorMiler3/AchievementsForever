# Builds dist\AchievementsForever-<version>.zip containing the two addon folders
# (AchievementsForever and AchievementsForeverData) at the zip root, so it can be
# extracted straight into Interface\AddOns. Nothing else is included.
#
#   powershell -ExecutionPolicy Bypass -File tools\package.ps1

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$toc = Get-Content (Join-Path $repo 'AchievementsForever\AchievementsForever_Forever.toc')
$version = ($toc | Where-Object { $_ -match '^## Version:\s*(.+)$' } | ForEach-Object { $Matches[1].Trim() } | Select-Object -First 1)
if (-not $version) { throw 'version not found in TOC' }

$dist = Join-Path $repo 'dist'
$stage = Join-Path $dist 'stage'
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force $stage | Out-Null

foreach ($folder in 'AchievementsForever', 'AchievementsForeverData') {
    Copy-Item -Recurse (Join-Path $repo $folder) (Join-Path $stage $folder)
}
# the licence must travel with the code (GPL-3.0)
Copy-Item (Join-Path $repo 'LICENSE') (Join-Path $stage 'AchievementsForever\LICENSE') -Force
Copy-Item (Join-Path $repo 'LICENSE') (Join-Path $stage 'AchievementsForeverData\LICENSE') -Force

$zip = Join-Path $dist "AchievementsForever-$version.zip"
if (Test-Path $zip) { Remove-Item -Force $zip }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal
Remove-Item -Recurse -Force $stage

$size = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "wrote $zip ($size MB)"
