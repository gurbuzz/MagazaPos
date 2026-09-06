@echo off
setlocal enabledelayedexpansion
title MagazaPOS - Windows 11 Kurulum Sihirbazi
cd /d "%~dp0"

echo ============================================================
echo   MagazaPOS - Windows 11 Kurulum ve Hazirlik Sihirbazi
echo ============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA] Node.js sisteminizde kurulu bulunamadi!
    echo.
    echo MagazaPOS kaynak kodlarini calistirabilmek icin Node.js gereklidir.
    echo.
    echo Cozum Secenekleri:
    echo ------------------------------------------------------------
    echo Secenek 1 (Tavsiye Edilen - Kurulumsuz / Hizli):
    echo   release\win-unpacked klasorundeki "MagazaPOS.exe" dosyasini
    echo   cift tiklayarak Node.js kurmadan DOGRUDAN calistirabilirsiniz!
    echo.
    echo Secenek 2:
    echo   https://nodejs.org/ adresinden Node.js "LTS" surumunu indirip
    echo   kurun, ardindan bu dosyayi tekrar calistirin.
    echo ------------------------------------------------------------
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js tespit edildi:
node -v
npm -v
echo.

echo [1/3] Yazilim Bagimliliklari Yukleniyor (npm install)...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [HATA] Bagimliliklar yuklenirken bir sorun olustu.
    pause
    exit /b 1
)

echo.
echo [2/3] Prisma Istemcisi ve Veritabani Hazirlaniyor...
call npx prisma generate
if not exist "prisma\dev.db" (
    echo SQLite veritabani olusturuluyor ve ornek urunler yukleniyor...
    call npx prisma db push
    call npx tsx prisma/seed.ts
) else (
    echo Mevcut veritabani korundu (prisma\dev.db mevcut).
)

echo.
echo [3/3] Uygulama Dosyalari Derleniyor...
call node scripts\copy-public.js
call npm run build

echo.
echo ============================================================
echo   TEBRIKLER! MagazaPOS Kurulumu Basariyla Tamamlandi!
echo ============================================================
echo.
echo Artik MagazaPOS'u calistirmak icin "BASLAT_WIN11.bat"
echo dosyasina cift tiklayabilirsiniz.
echo.
pause