@echo off
chcp 65001 >nul 2>nul
title MagazaPOS - Windows .EXE Paketleme Araci
cd /d "%~dp0"

echo ============================================================
echo   MagazaPOS Windows (.EXE) Paketleme Araci
echo   Terminal olmadan calisan masaustu paketi olusturuluyor...
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [HATA] Node.js bulunamadi.
    pause
    exit /b
)

REM --- node_modules eksik/yarim mi kontrol et ---
set "NEED_INSTALL=0"
if not exist "node_modules" set "NEED_INSTALL=1"
if not exist "node_modules\prisma" set "NEED_INSTALL=1"
if not exist "node_modules\.bin\prisma.cmd" set "NEED_INSTALL=1"

if "%NEED_INSTALL%"=="1" (
    echo [BILGI] Eksik veya yarim node_modules tespit edildi.
    echo [BILGI] npm install calistiriliyor, lutfen bekleyin...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [HATA] npm install basarisiz!
        echo Lutfen internet baglantinizi kontrol edip tekrar deneyin.
        pause
        exit /b
    )
    echo.
    echo [OK] npm install tamamlandi.
    echo.
) else (
    echo [OK] node_modules hazir.
    echo.
)

REM Code signing devre disi birak
set CSC_IDENTITY_AUTO_DISCOVERY=false
set WIN_CSC_LINK=

echo [BILGI] .EXE paketi olusturuluyor, lutfen bekleyiniz...
echo.
call npm run package:win
if errorlevel 1 (
    echo.
    echo [HATA] Paketleme basarisiz oldu.
    pause
    exit /b
)

echo.
echo ============================================================
echo   [BASARILI] MagazaPOS .EXE Paketi Olusturuldu!
echo   release\ klasorunu kontrol edebilirsiniz.
echo ============================================================
echo.

:: Masaustu kisayolunu guncelle
if exist "release\win-unpacked" (
    for %%F in ("release\win-unpacked\*.exe") do (
        echo [BILGI] MagazaPOS simdi terminal olmadan baslatiliyor...
        start "" "%%~fF"
        exit /b
    )
)

pause