kurulum = """@echo off
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
    echo   release\\win-unpacked klasorundeki "MagazaPOS.exe" dosyasini
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
if not exist "prisma\\dev.db" (
    echo SQLite veritabani olusturuluyor ve ornek urunler yukleniyor...
    call npx prisma db push
    call npx tsx prisma/seed.ts
) else (
    echo Mevcut veritabani korundu (prisma\\dev.db mevcut).
)

echo.
echo [3/3] Uygulama Dosyalari Derleniyor...
call node scripts\\copy-public.js
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
"""

baslat = """@echo off
title MagazaPOS - Kasa ve Stok Sistemi
cd /d "%~dp0"

echo ============================================================
echo   MagazaPOS Kasa ve Stok Yonetim Sistemi Baslatiliyor...
echo ============================================================
echo.

if exist "release\\win-unpacked\\MagazaPOS.exe" (
    echo [BILGI] Derlenmis hazir masaustu surumu bulundu.
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [UYARI] Node.js sisteminizde kurulu bulunamadi.
    echo.
    if exist "release\\win-unpacked\\MagazaPOS.exe" (
        echo Hazir derlenmis surum tespit edildi!
        echo Node.js kurmaniza gerek kalmadan MagazaPOS simdi aciliyor...
        echo.
        start "" "release\\win-unpacked\\MagazaPOS.exe"
        exit /b 0
    )
    echo [HATA] Node.js bulunamadi ve derlenmis exe paketi yok.
    echo Lutfen https://nodejs.org adresinden Node.js LTS surumunu kurun
    echo veya "release\\win-unpacked" klasorundeki hazir programi kullanin.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Ilk calistirma tespit edildi, bagimliliklar yukleniyor...
    call npm install
    call npx prisma generate
)

call node scripts\\copy-public.js

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
"""

with open("KURULUM_WIN11.bat", "wb") as f:
    f.write(kurulum.strip().replace("\n", "\r\n").encode("utf-8"))

with open("BASLAT_WIN11.bat", "wb") as f:
    f.write(baslat.strip().replace("\n", "\r\n").encode("utf-8"))

print("OK: Batch files written with DOS CRLF line endings.")
