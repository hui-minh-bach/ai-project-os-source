@echo off
setlocal EnableExtensions
where git >nul 2>nul
if not errorlevel 1 (
 echo Git da co san tren may. Co the chay AI Team / Git worktree.
 pause
 exit /b 0
)
echo.
echo AI Project OS AI Team can Git de tao nhanh, kiem tra thay doi va luu phien ban.
echo Ban sap cai Git for Windows thong qua Windows Package Manager (winget).
echo Git la phan mem ben thu ba, co giay phep GPL-2.0; khong duoc bundle trong goi nay.
echo.
where winget >nul 2>nul
if errorlevel 1 (
 echo Khong tim thay winget. Ban co the cai Git tu https://git-scm.com/downloads/win
 pause
 exit /b 1
)
set /p "ACCEPT=Nhap CO de cai Git, phim khac de huy: "
if /I not "%ACCEPT%"=="CO" exit /b 0
winget install --id Git.Git --exact --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
 echo Cai Git that bai. Kiem tra thong bao winget, hoac cai tu trang Git chinh thuc.
 pause
 exit /b 1
)
echo Cai dat Git xong. DONG AI Project OS, mo lai de cap nhat PATH.
pause
