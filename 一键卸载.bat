@echo off
chcp 65001 >nul
pushd "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1" %*
set RC=%ERRORLEVEL%
echo.
if not "%RC%"=="0" echo [WARN] 卸载未完成，退出码: %RC%
pause
popd
exit /b %RC%