#Requires -Version 5.1
<#
  Antigravity Chinese Suite - 统一安装器 (Windows PowerShell)
  核心逻辑委托给 scripts/suite.js，确保跨平台一致性与幂等重装。
#>
[CmdletBinding()]
param(
    [string]$AppDir = "",
    [switch]$SkipLocalization,
    [switch]$SkipViewer,
    [switch]$Yes,
    [switch]$ForceStop,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host '[FAIL] 未找到 Node.js。请先安装 Node.js (>= 22.4.0，仅装汉化需 >= 18.18.0): https://nodejs.org/' -ForegroundColor Red
    exit 1
}

$suiteJs = Join-Path $PSScriptRoot 'scripts\suite.js'
if (-not (Test-Path $suiteJs)) {
    Write-Host "[FAIL] 缺少核心脚本: $suiteJs（请完整解压仓库后再运行）" -ForegroundColor Red
    exit 1
}

$cliArgs = @($suiteJs, 'install')
if ($AppDir) { $cliArgs += @('--app-dir', $AppDir) }
if ($SkipLocalization) { $cliArgs += '--skip-localization' }
if ($SkipViewer) { $cliArgs += '--skip-viewer' }
if ($Yes) { $cliArgs += '--yes' }
if ($ForceStop) { $cliArgs += '--force-stop' }
if ($DryRun) { $cliArgs += '--dry-run' }

& node @cliArgs
exit $LASTEXITCODE