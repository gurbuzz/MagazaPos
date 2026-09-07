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