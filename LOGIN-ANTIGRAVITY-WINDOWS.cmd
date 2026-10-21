@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem The app passes the exact agy.exe path its own resolver found (AIOS_AGY_EXE);
rem trust it first so this window never disagrees with the app's detection.
set "AGY="
if defined AIOS_AGY_EXE if exist "%AIOS_AGY_EXE%" set "AGY=%AIOS_AGY_EXE%"
if not defined AGY if exist "%LOCALAPPDATA%\agy\bin\agy.exe" set "AGY=%LOCALAPPDATA%\agy\bin\agy.exe"
if not defined AGY if exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\agy.exe" set "AGY=%LOCALAPPDATA%\Microsoft\WinGet\Links\agy.exe"
for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\Google.AntigravityCLI*") do (
  if not defined AGY if exist "%%D\agy.exe" set "AGY=%%D\agy.exe"
  if not defined AGY if exist "%%D\bin\agy.exe" set "AGY=%%D\bin\agy.exe"
  if not defined AGY for /d %%S in ("%%D\*") do (
    if not defined AGY if exist "%%S\agy.exe" set "AGY=%%S\agy.exe"
    if not defined AGY if exist "%%S\bin\agy.exe" set "AGY=%%S\bin\agy.exe"
  )
)
if not defined AGY if exist "%LOCALAPPDATA%\Programs\Antigravity CLI\bin\agy.exe" set "AGY=%LOCALAPPDATA%\Programs\Antigravity CLI\bin\agy.exe"
if not defined AGY if exist "%LOCALAPPDATA%\Programs\Antigravity\bin\agy.exe" set "AGY=%LOCALAPPDATA%\Programs\Antigravity\bin\agy.exe"
if not defined AGY if exist "%USERPROFILE%\.local\bin\agy.exe" set "AGY=%USERPROFILE%\.local\bin\agy.exe"
if not defined AGY (
  for /f "delims=" %%F in ('where agy.exe 2^>nul') do if not defined AGY set "AGY=%%F"
)
if not defined AGY (
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
