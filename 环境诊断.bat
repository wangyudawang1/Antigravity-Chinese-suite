@echo off
chcp 65001 >nul
pushd "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0doctor.ps1" %*
set RC=%ERRORLEVEL%
echo.
if not "%RC%"=="0" echo [WARN] 诊断发现异常项，退出码: %RC%
pause
popd
exit /b %RC%