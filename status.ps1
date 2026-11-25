#Requires -Version 5.1
<#
  Antigravity Chinese Suite - 状态查看器 (Windows PowerShell)
#>
[CmdletBinding()]
param(
    [string]$AppDir = "",
    [switch]$Json
)

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host '[FAIL] 未找到 Node.js: https://nodejs.org/' -ForegroundColor Red
    exit 1
}

$suiteJs = Join-Path $PSScriptRoot 'scripts\suite.js'
if (-not (Test-Path $suiteJs)) {
    Write-Host "[FAIL] 缺少核心脚本: $suiteJs" -ForegroundColor Red
    exit 1
}

$cliArgs = @($suiteJs, 'status')
if ($AppDir) { $cliArgs += @('--app-dir', $AppDir) }
if ($Json) { $cliArgs += '--json' }

& node @cliArgs
exit $LASTEXITCODE