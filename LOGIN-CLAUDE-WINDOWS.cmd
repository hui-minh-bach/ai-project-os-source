@echo off
setlocal
cd /d "%~dp0"
if exist "runtime-win-x64\node.exe" if exist "runtime-win-x64\node_modules\npm\bin\npm-cli.js" (set "NODEEXE=%~dp0runtime-win-x64\node.exe") else (set "NODEEXE=node")
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" if exist "runtime-win-arm64\node.exe" if exist "runtime-win-arm64\node_modules\npm\bin\npm-cli.js" set "NODEEXE=%~dp0runtime-win-arm64\node.exe"
if "%NODEEXE%"=="node" (
  where node >nul 2>nul
  if errorlevel 1 (set "NODEEXE=") else (
    for /f "delims=" %%v in ('node -p "Number(process.versions.node.split('.')[0])>=22?'OK':'OLD'"') do if "%%v"=="OLD" set "NODEEXE="
  )
)
if not defined NODEEXE (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0SETUP-RUNTIME-WINDOWS.ps1"
  if errorlevel 1 (echo Node runtime setup failed. & pause & exit /b 1)
  if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" (set "NODEEXE=%~dp0runtime-win-arm64\node.exe") else (set "NODEEXE=%~dp0runtime-win-x64\node.exe")
)
"%NODEEXE%" tools\cli-login.mjs claude
if errorlevel 1 echo Login failed: see message above.
pause
