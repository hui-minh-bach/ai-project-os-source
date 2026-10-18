@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
set "NODEEXE="
if exist "runtime-win-x64\node.exe" if exist "runtime-win-x64\node_modules\npm\bin\npm-cli.js" set "NODEEXE=%~dp0runtime-win-x64\node.exe"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" if exist "runtime-win-arm64\node.exe" if exist "runtime-win-arm64\node_modules\npm\bin\npm-cli.js" set "NODEEXE=%~dp0runtime-win-arm64\node.exe"
if not defined NODEEXE (
  where node >nul 2>nul
  if not errorlevel 1 (
    for /f "delims=" %%v in ('node -p "Number(process.versions.node.split('.')[0])>=22?'OK':'OLD'"') do if "%%v"=="OK" set "NODEEXE=node"
  )
)
if not defined NODEEXE (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0SETUP-RUNTIME-WINDOWS.ps1"
  if errorlevel 1 (echo Node runtime setup failed. & pause & exit /b 1)
  if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" (set "NODEEXE=%~dp0runtime-win-arm64\node.exe") else (set "NODEEXE=%~dp0runtime-win-x64\node.exe")
)
if "%~1"=="" (
  echo Install tools: 1 Codex, 2 Claude Code, 3 Gemini CLI, 4 Codex + Claude (tai khoan Google ca nhan dung Antigravity)
  choice /c 1234 /n /m "Your choice: "
  if errorlevel 4 (set "KIND=all") else if errorlevel 3 (set "KIND=gemini") else if errorlevel 2 (set "KIND=claude") else (set "KIND=codex")
) else (set "KIND=%~1")
"%NODEEXE%" tools\install-ai-clis.mjs "%KIND%"
if errorlevel 1 (echo Installation failed. & pause & exit /b 1)
echo Done. Return to AI Project OS and sign in.
pause
endlocal
