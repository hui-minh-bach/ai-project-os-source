@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "AGY=%LOCALAPPDATA%\agy\bin\agy.exe"
if not exist "%AGY%" set "AGY=%LOCALAPPDATA%\Microsoft\WinGet\Links\agy.exe"
if not exist "%AGY%" (
  for /f "delims=" %%F in ('where agy.exe 2^>nul') do if not defined AGY_FOUND set "AGY_FOUND=%%F"
  if defined AGY_FOUND set "AGY=%AGY_FOUND%"
)
if not exist "%AGY%" (
  echo Antigravity CLI chua duoc cai. Xem https://www.antigravity.google/docs/cli/install/
  pause
  exit /b 1
)
set "USERPROFILE=%LOCALAPPDATA%\AIProjectOSLocal\data\cli-profiles\antigravity"
set "HOME=%USERPROFILE%"
if not exist "%HOME%" mkdir "%HOME%"
"%AGY%"
if errorlevel 1 echo Google Antigravity CLI exit with error. Use the official installer to update it.
pause
endlocal
