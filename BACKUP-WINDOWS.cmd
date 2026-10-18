@echo off
setlocal
cd /d "%~dp0"
set "NODEEXE=node"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
 if exist "runtime-win-arm64\node.exe" set "NODEEXE=%CD%\runtime-win-arm64\node.exe"
) else (
 if exist "runtime-win-x64\node.exe" set "NODEEXE=%CD%\runtime-win-x64\node.exe"
)
"%NODEEXE%" tools\customer-data.mjs backup
pause
