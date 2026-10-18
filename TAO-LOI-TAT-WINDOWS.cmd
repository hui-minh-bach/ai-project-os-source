@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CREATE-SHORTCUT-WINDOWS.ps1"
if errorlevel 1 (echo Khong tao duoc loi tat, van co the mo RUN-WINDOWS.cmd)
pause
