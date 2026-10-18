@echo off
setlocal EnableExtensions
where ffmpeg >nul 2>nul
if not errorlevel 1 (
  where ffprobe >nul 2>nul
  if not errorlevel 1 (
    echo FFmpeg va FFprobe da san sang tren may.
    pause
    exit /b 0
  )
)
echo.
echo AI Project OS Video Studio can FFmpeg/FFprobe de dung video MP4.
echo Ban sap cai Gyan.FFmpeg tu Windows Package Manager (winget).
echo Day la phan mem ben thu ba, co dieu khoan va giay phep rieng (GPL-3.0).
echo No chi can cai mot lan tren may khach; khong trich hop vao ma nguon AI Project OS.
echo.
where winget >nul 2>nul
if errorlevel 1 (
 echo Khong co winget. Cai Microsoft App Installer truoc, hoac tai tu https://ffmpeg.org/download.html
 pause
 exit /b 1
)
set /p "ACCEPT=Nhap CO de cai, phim khac de huy: "
if /I not "%ACCEPT%"=="CO" exit /b 0
winget install --id Gyan.FFmpeg --exact --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
 echo Cai dat that bai. Xem thong bao winget phia tren.
 pause
 exit /b 1
)
echo Hoan thanh cai dat. HAY DONG roi mo lai AI Project OS de nhan FFmpeg vao PATH.
pause
