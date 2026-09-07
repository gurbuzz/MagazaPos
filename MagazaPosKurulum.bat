@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title MagazaPOS - Kasa ve Stok Yonetim Sistemi
cd /d "%~dp0"

echo ============================================================
echo   MagazaPOS - Kasa ve Stok Yonetim Sistemi
echo   Lufian ve Jack Jones POS
echo ============================================================
echo.

:: 1. Masaustu Kisayolu (Shortcut & Icon) Olusturma
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $d = [Environment]::GetFolderPath('Desktop'); $lnk = Join-Path $d 'MagazaPOS.lnk'; if (-not (Test-Path $lnk)) { $s = $ws.CreateShortcut($lnk); $target = '%~dp0MagazaPosKurulum.bat'; $exe = Get-ChildItem -Path '%~dp0release\win-unpacked' -Filter '*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($exe) { $target = $exe.FullName }; $s.TargetPath = $target; $s.WorkingDirectory = '%~dp0'; if (Test-Path '%~dp0public\icon.ico') { $s.IconLocation = '%~dp0public\icon.ico,0' }; $s.WindowStyle = 7; $s.Description = 'MagazaPOS Kasa ve Stok Yonetim Sistemi'; $s.Save(); Write-Host '[OK] Masaustune MagazaPOS kisayolu olusturuldu.' }" >nul 2>&1

:: 2. Node.js Kontrolu
where node >nul 2>nul
if !errorlevel! neq 0 (
    echo [UYARI] Node.js sisteminizde kurulu bulunamadi.
    echo.
    for %%F in ("release\win-unpacked\*.exe") do (
        echo [BILGI] Hazir derlenmis surum tespit edildi: %%~nxF
        echo Node.js gerekmeden MagazaPOS simdi baslatiliyor...
        echo.
        start "" "%%~fF"
        exit /b 0
    )
    echo [HATA] Node.js bulunamadi ve derlenmis exe paketi yok.
    echo Lutfen https://nodejs.org adresinden Node.js 'LTS' surumunu kurun.
    echo.
    pause
    exit /b 1
)

:: 3. Ortam Dosyasi (.env) Kontrolu
if not exist ".env" (
    echo [BILGI] .env yapilandirma dosyasi hazirlaniyor...
    (echo DATABASE_URL="file:./dev.db")> .env
    (echo PORT=3782)>> .env
)

if not exist "prisma" mkdir "prisma"

:: 4. Ilk Kurulum / Paket Kontrolu
set "NEED_SETUP=0"
if not exist "node_modules" set "NEED_SETUP=1"
if not exist "node_modules\.prisma\client" set "NEED_SETUP=1"

if "!NEED_SETUP!"=="1" (
    echo.
    echo ============================================================
    echo   Ilk Calistirma / Otomatik Kurulum Basliyor...
    echo   Lutfen paketler yuklenirken bekleyiniz.
    echo ============================================================
    echo.
    echo [1/3] Paket bagimliliklari yukleniyor (npm install)...
    call npm install
    if !errorlevel! neq 0 (
        echo.
        echo [HATA] npm install sirasinda hata olustu.
        pause
        exit /b 1
    )

    echo.
    echo [2/3] Prisma istemcisi hazirlaniyor...
    call npx prisma generate
    if !errorlevel! neq 0 (
        echo.
        echo [HATA] prisma generate sirasinda hata olustu.
        pause
        exit /b 1
    )
)

:: 5. SQLite Veritabani ve Baslangic Tablolari Kontrolu
if not exist "prisma\dev.db" (
    echo.
    echo [BILGI] Veritabani bulunamadi. Tablolar olusturuluyor...
    call npx prisma db push --accept-data-loss
    if !errorlevel! neq 0 (
        echo.
        echo [HATA] Veritabani semasi yuklenirken hata olustu.
        pause
        exit /b 1
    )

    echo [BILGI] Baslangic giyim kategorileri ve ornek urunler yukleniyor...
    call npx tsx prisma/seed.ts
)

:: 6. Statik Mobil Dosyalarini Kopyala
if exist "scripts\copy-public.js" (
    call node scripts\copy-public.js
)

:: 7. Uygulamayi Baslat
echo.
echo ============================================================
echo   MagazaPOS Baslatiliyor...
echo   (Masaustunuzdeki "MagazaPOS" simgesini de kullanabilirsiniz)
echo ============================================================
echo.

call npm run dev

echo.
echo [BILGI] MagazaPOS oturumu sonlandi.
pause