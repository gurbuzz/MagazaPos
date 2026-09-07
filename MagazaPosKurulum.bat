@echo off
chcp 65001 >nul 2>nul
title MagazaPOS - Kasa ve Stok Yonetim Sistemi
cd /d "%~dp0"

:: Ne olursa olsun pencere acik kalsin
call :main
echo.
echo Devam etmek icin bir tusa basin...
pause >nul
exit /b

:main
setlocal enabledelayedexpansion

echo ============================================================
echo   MagazaPOS - Kasa ve Stok Yonetim Sistemi
echo   Lufian ve Jack Jones POS
echo ============================================================
echo.

:: 1. Masaustu Kisayolu Olustur
call :kisayol

:: 2. Node.js Kontrolu
where node >nul 2>nul
if errorlevel 1 (
    echo [UYARI] Node.js sisteminizde kurulu bulunamadi.
    echo.
    if exist "release\win-unpacked" (
        for %%F in ("release\win-unpacked\*.exe") do (
            echo [BILGI] Hazir derlenmis surum tespit edildi: %%~nxF
            echo Node.js gerekmeden MagazaPOS simdi baslatiliyor...
            echo.
            start "" "%%~fF"
            goto :eof
        )
    )
    echo [HATA] Node.js bulunamadi ve derlenmis exe paketi yok.
    echo Lutfen https://nodejs.org adresinden Node.js LTS surumunu kurun.
    echo.
    goto :eof
)

echo [OK] Node.js tespit edildi.
node -v
echo.

:: 3. Ortam Dosyasi (.env)
if not exist ".env" (
    echo [BILGI] .env yapilandirma dosyasi hazirlaniyor...
    echo DATABASE_URL="file:./dev.db"> ".env"
    echo PORT=3782>> ".env"
)

:: 4. Prisma klasoru
if not exist "prisma" mkdir "prisma"

:: 5. Ilk Kurulum / Paket Kontrolu
if not exist "node_modules" goto :kurulum
if not exist "node_modules\.prisma\client" goto :kurulum
goto :kurulum_atla

:kurulum
echo.
echo ============================================================
echo   Ilk Calistirma - Otomatik Kurulum Basliyor
echo   Lutfen paketler yuklenirken bekleyiniz...
echo ============================================================
echo.
echo [1/3] Paket bagimliliklari yukleniyor (npm install)...
call npm install
if errorlevel 1 (
    echo.
    echo [HATA] npm install sirasinda hata olustu.
    goto :eof
)

echo.
echo [2/3] Prisma istemcisi hazirlaniyor...
call npx prisma generate
if errorlevel 1 (
    echo.
    echo [HATA] prisma generate sirasinda hata olustu.
    goto :eof
)

:kurulum_atla

:: 6. Veritabani Kontrolu
if not exist "prisma\dev.db" (
    echo.
    echo [3/3] Veritabani bulunamadi. Tablolar olusturuluyor...
    call npx prisma db push --accept-data-loss
    if errorlevel 1 (
        echo.
        echo [HATA] Veritabani semasi olusturulurken hata olustu.
        goto :eof
    )
    echo [BILGI] Baslangic urunleri yukleniyor...
    call npx tsx prisma/seed.ts
)

:: 7. Statik Dosyalari Kopyala
if exist "scripts\copy-public.js" (
    call node scripts\copy-public.js
)

:: 8. Uygulamayi Baslat
echo.
echo ============================================================
echo   MagazaPOS Baslatiliyor...
echo   Masaustunuzdeki MagazaPOS simgesini de kullanabilirsiniz.
echo ============================================================
echo.

call npm run dev

echo.
echo [BILGI] MagazaPOS oturumu sonlandi.
goto :eof

:: -----------------------------------------------------------
:: Masaustu kisayolu olusturma (ayri fonksiyon)
:: -----------------------------------------------------------
:kisayol
set "VBS_FILE=%TEMP%\magazapos_shortcut.vbs"
set "BAT_PATH=%~dp0MagazaPosKurulum.bat"
set "ICON_PATH=%~dp0public\icon.ico"

:: Derlenmis exe varsa onu hedef al
if exist "release\win-unpacked" (
    for %%F in ("release\win-unpacked\*.exe") do (
        set "BAT_PATH=%%~fF"
    )
)

:: Masaustunde zaten kisayol varsa tekrar olusturma
set "DESKTOP="
for /f "usebackq tokens=*" %%D in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "DESKTOP=%%D"
if "!DESKTOP!"=="" goto :eof
if exist "!DESKTOP!\MagazaPOS.lnk" goto :eof

:: VBScript ile kisayol olustur (PowerShell'den daha guvenilir)
(
    echo Set ws = CreateObject("WScript.Shell"^)
    echo Set lnk = ws.CreateShortcut("!DESKTOP!\MagazaPOS.lnk"^)
    echo lnk.TargetPath = "!BAT_PATH!"
    echo lnk.WorkingDirectory = "%~dp0"
    echo lnk.Description = "MagazaPOS Kasa ve Stok Yonetim Sistemi"
    echo lnk.WindowStyle = 7
    if exist "!ICON_PATH!" echo lnk.IconLocation = "!ICON_PATH!, 0"
    echo lnk.Save
)> "!VBS_FILE!"

cscript //nologo "!VBS_FILE!" >nul 2>&1
del "!VBS_FILE!" >nul 2>&1
echo [OK] Masaustune MagazaPOS kisayolu olusturuldu.
goto :eof