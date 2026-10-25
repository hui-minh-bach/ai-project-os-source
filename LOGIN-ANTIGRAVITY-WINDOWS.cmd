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
rem Per-connection profile (v0.9.56): the app passes AIOS_AGY_PROFILE (the
rem exact session folder of the account being signed in) and AIOS_AGY_ACCOUNT
rem (its display name for the window title). Run by hand without the app,
rem the legacy folder below is used — the first account's home.
set "USERPROFILE=%LOCALAPPDATA%\AIProjectOSPersonal\data\cli-profiles\antigravity"
if defined AIOS_AGY_PROFILE set "USERPROFILE=%AIOS_AGY_PROFILE%"
set "HOME=%USERPROFILE%"
if defined AIOS_AGY_ACCOUNT title Dang nhap Antigravity - %AIOS_AGY_ACCOUNT%
if not exist "%HOME%" mkdir "%HOME%"
"%AGY%"
if errorlevel 1 echo Google Antigravity CLI exit with error. Use the official installer to update it.
pause
endlocal
