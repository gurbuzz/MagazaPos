@echo off
title MagazaPOS - Kasa ve Stok Sistemi
cd /d "%~dp0"

echo ============================================================
echo   MagazaPOS Kasa ve Stok Yonetim Sistemi Baslatiliyor...
echo ============================================================
echo.

if exist "release\win-unpacked\MagazaPOS.exe" (
    echo [BILGI] Derlenmis hazir masaustu surumu bulundu.
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [UYARI] Node.js sisteminizde kurulu bulunamadi.
    echo.
    if exist "release\win-unpacked\MagazaPOS.exe" (
        echo Hazir derlenmis surum tespit edildi!
        echo Node.js kurmaniza gerek kalmadan MagazaPOS simdi aciliyor...
        echo.
        start "" "release\win-unpacked\MagazaPOS.exe"
        exit /b 0
    )
    echo [HATA] Node.js bulunamadi ve derlenmis exe paketi yok.
    echo Lutfen https://nodejs.org adresinden Node.js LTS surumunu kurun
    echo veya "release\win-unpacked" klasorundeki hazir programi kullanin.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Ilk calistirma tespit edildi, bagimliliklar yukleniyor...
    call npm install
    call npx prisma generate
)

call node scripts\copy-public.js

echo.
echo MagazaPOS Baslatiliyor...
echo Lutfen bu konsol penceresini kapatmayiniz.
echo.
call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [BILGI] MagazaPOS kapandi veya bir hata olustu.
    pause
)