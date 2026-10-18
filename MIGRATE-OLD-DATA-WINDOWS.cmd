@echo off
setlocal
cd /d "%~dp0"
set "NODEEXE=node"
if exist "runtime-win-x64\node.exe" set "NODEEXE=%CD%\runtime-win-x64\node.exe"
"%NODEEXE%" tools\customer-data.mjs migrate
pause
