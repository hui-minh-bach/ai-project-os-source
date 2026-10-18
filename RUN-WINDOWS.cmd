@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
set "NODEEXE="
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
  if exist "runtime-win-arm64\node.exe" if exist "runtime-win-arm64\node_modules\npm\bin\npm-cli.js" set "NODEEXE=%CD%\runtime-win-arm64\node.exe"
) else (
  if exist "runtime-win-x64\node.exe" if exist "runtime-win-x64\node_modules\npm\bin\npm-cli.js" set "NODEEXE=%CD%\runtime-win-x64\node.exe"
)
if not defined NODEEXE (
  where node >nul 2>nul
  if not errorlevel 1 (
    for /f "delims=" %%v in ('node -p "Number(process.versions.node.split('.')[0])>=22?'OK':'OLD'"') do if "%%v"=="OK" set "NODEEXE=node"
  )
)
if not defined NODEEXE (
  echo [AI Project OS] Dang cai Node.js portable da kiem tra SHA-256...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0SETUP-RUNTIME-WINDOWS.ps1"
  if errorlevel 1 (
    echo Khong the tai Node.js. Kiem tra Internet hoac cai Node.js 22+ tu nodejs.org
    pause
    exit /b 1
  )
  if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" (set "NODEEXE=%CD%\runtime-win-arm64\node.exe") else (set "NODEEXE=%CD%\runtime-win-x64\node.exe")
)
set "AI_PROJECT_OS_NODE=%NODEEXE%"
"%NODEEXE%" src\launcher.mjs
if errorlevel 1 (echo Phat hien loi khoi dong. Vui long xem thong bao o tren. & pause & exit /b 1)
endlocal
