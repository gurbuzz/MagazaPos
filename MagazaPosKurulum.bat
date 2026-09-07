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

:: 2. Derlenmis .exe varsa terminal olmadan dogrudan baslat
if exist "release\win-unpacked" (
    for %%F in ("release\win-unpacked\*.exe") do (
        echo [BILGI] Derlenmis MagazaPOS surumu tespit edildi: %%~nxF
        echo Arka plan konsolu olmadan dogrudan baslatiliyor...
        start "" "%%~fF"
        goto :eof
    )
)

:: 3. Node.js Kontrolu
where node >nul 2>nul
if errorlevel 1 (
    echo [HATA] Node.js sisteminizde kurulu bulunamadi ve derlenmis .exe yok.
    echo Lutfen https://nodejs.org adresinden Node.js LTS surumunu kurun.
    echo.
    goto :eof
)

echo [OK] Node.js tespit edildi.
node -v
echo.

:: 4. Ortam Dosyasi (.env)
if not exist ".env" (
    echo [BILGI] .env yapilandirma dosyasi hazirlaniyor...
    echo DATABASE_URL="file:./dev.db"> ".env"
    echo PORT=3782>> ".env"
)

:: 5. Prisma klasoru
if not exist "prisma" mkdir "prisma"

:: 6. Ilk Kurulum / Paket Kontrolu
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

:: 7. Veritabani Kontrolu
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

:: 8. Statik Dosyalari Kopyala
if exist "scripts\copy-public.js" (
    call node scripts\copy-public.js
)

:: 9. Calistirma / Paketleme Secenegi
echo.
echo ============================================================
echo   MagazaPOS Baslatma Secenekleri:
echo ============================================================
echo   [1] Hizli Baslat (Terminal arkada acik kalir)
echo   [2] Windows .EXE Olarak Paketle (Terminal tamamen kapanir - Tavsiye Edilen)
echo ============================================================
echo.
set "SECIM=1"
set /p "SECIM=Seciminiz [1 veya 2] (Enter ile 1 baslatilir): "

if "!SECIM!"=="2" (
    echo.
    echo ============================================================
    echo   MagazaPOS Windows .EXE paketi olusturuluyor...
    echo   Bu islem bir defaya mahsus yapilir ve birkac dakika surebilir.
    echo   Lutfen bekleyiniz...
    echo ============================================================
    echo.
    call npm run package:win
    if errorlevel 1 (
        echo.
        echo [UYARI] Paketleme sirasinda hata olustu. Hizli modda baslatiliyor...
        call npm run dev
        goto :eof
    )
    echo.
    echo ============================================================
    echo   [TEBRIKLER] MagazaPOS .EXE Kurulum Paketi Olusturuldu!
    echo   Kurulum Setup Dosyasi: release\ klasorundedir.
    echo   Kurulumsuz Calisan EXE: release\win-unpacked\MagazaPOS.exe
    echo ============================================================
    echo.
    call :kisayol
    if exist "release\win-unpacked" (
        for %%F in ("release\win-unpacked\*.exe") do (
            echo MagazaPOS simdi baslatiliyor (Sifir terminal)...
            start "" "%%~fF"
            goto :eof
        )
    )
    goto :eof
)

echo.
echo ============================================================
echo   MagazaPOS Baslatiliyor...
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
set "TARGET_PATH=%~dp0MagazaPosKurulum.bat"
set "ICON_PATH=%~dp0public\icon.ico"
set "WIN_STYLE=7"

:: Derlenmis exe varsa kisayolu dogrudan EXE'ye bagla (sifir terminal)
if exist "release\win-unpacked" (
    for %%F in ("release\win-unpacked\*.exe") do (
        set "TARGET_PATH=%%~fF"
        set "WIN_STYLE=1"
    )
)

set "DESKTOP="
for /f "usebackq tokens=*" %%D in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "DESKTOP=%%D"
if "!DESKTOP!"=="" goto :eof

(
    echo Set ws = CreateObject("WScript.Shell"^)
    echo Set lnk = ws.CreateShortcut("!DESKTOP!\MagazaPOS.lnk"^)
    echo lnk.TargetPath = "!TARGET_PATH!"
    echo lnk.WorkingDirectory = "%~dp0"
    echo lnk.Description = "MagazaPOS Kasa ve Stok Yonetim Sistemi"
    echo lnk.WindowStyle = !WIN_STYLE!
    if exist "!ICON_PATH!" echo lnk.IconLocation = "!ICON_PATH!, 0"
    echo lnk.Save
)> "!VBS_FILE!"

cscript //nologo "!VBS_FILE!" >nul 2>&1
del "!VBS_FILE!" >nul 2>&1
echo [OK] Masaustune MagazaPOS kisayolu olusturuldu.
goto :eof