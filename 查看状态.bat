@echo off
chcp 65001 >nul
pushd "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0status.ps1" %*
set RC=%ERRORLEVEL%
echo.
if not "%RC%"=="0" echo [WARN] 状态查询退出码: %RC%
pause
popd
exit /b %RC%