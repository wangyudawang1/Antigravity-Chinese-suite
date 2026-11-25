#Requires -Version 5.1
<#
  Antigravity Chinese Suite - 统一卸载器 (Windows PowerShell)
#>
[CmdletBinding()]
param(
    [string]$AppDir = "",
    [switch]$OnlyViewer,
    [switch]$RemoveBackup,
    [switch]$Yes,
    [switch]$ForceStop,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host '[FAIL] 未找到 Node.js，无法执行版本校验与安全还原: https://nodejs.org/' -ForegroundColor Red
    exit 1
}

$suiteJs = Join-Path $PSScriptRoot 'scripts\suite.js'
if (-not (Test-Path $suiteJs)) {
    Write-Host "[FAIL] 缺少核心脚本: $suiteJs（请完整解压仓库后再运行）" -ForegroundColor Red
    exit 1
}

$cliArgs = @($suiteJs, 'uninstall')
if ($AppDir) { $cliArgs += @('--app-dir', $AppDir) }
if ($OnlyViewer) { $cliArgs += '--only-viewer' }
if ($RemoveBackup) { $cliArgs += '--remove-backup' }
if ($Yes) { $cliArgs += '--yes' }
if ($ForceStop) { $cliArgs += '--force-stop' }
if ($DryRun) { $cliArgs += '--dry-run' }

& node @cliArgs
exit $LASTEXITCODE