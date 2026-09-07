@echo off
chcp 65001 >nul 2>nul
title MagazaPOS - Kurulum ve Baslat

:: Pencere her zaman acik kalsin - en basa koy
if "%1"=="--inner" goto :baslat_ic

:: Kendini yeniden ac, bu sefer pencere kapanmaz
cmd.exe /k ""%~f0" --inner"
exit

:baslat_ic
cd /d "%~dp0"
cls

echo.
echo  ============================================================
echo    MagazaPOS - Kasa ve Stok Yonetim Sistemi
echo  ============================================================
echo.

:: ============================================================
:: 1. Node.js Kontrol
:: ============================================================
where node >nul 2>nul
if errorlevel 1 (
    echo  [HATA] Node.js bulunamadi!
    echo  Lutfen https://nodejs.org adresinden Node.js LTS indirin.
    echo.
    pause
    exit /b 1
)
echo  [OK] Node.js bulundu:
node -v
echo.

:: ============================================================
:: 2. .env Dosyasi
:: ============================================================
if not exist ".env" (
    echo  [BILGI] .env dosyasi olusturuluyor...
    (
        echo DATABASE_URL="file:./dev.db"
        echo PORT=3782
    ) > ".env"
    echo  [OK] .env olusturuldu.
    echo.
)

:: ============================================================
:: 3. node_modules Kontrol / npm install
:: ============================================================
if not exist "node_modules" (
    echo  [1/3] node_modules bulunamadi - npm install basliyor...
    echo  Bu islem birkas dakika surebilir, lutfen bekleyin...
    echo.
    npm install
    if errorlevel 1 (
        echo.
        echo  [HATA] npm install basarisiz oldu!
        echo  Lutfen internet baglantinizi kontrol edin.
        pause
        exit /b 1
    )
    echo  [OK] npm install tamamlandi.
    echo.
)

:: ============================================================
:: 4. Prisma Client
:: ============================================================
if not exist "node_modules\.prisma\client" (
    echo  [2/3] Prisma istemcisi hazirlaniyor...
    call npx prisma generate
    if errorlevel 1 (
        echo.
        echo  [HATA] prisma generate basarisiz oldu!
        pause
        exit /b 1
    )
    echo  [OK] Prisma istemcisi hazirlandi.
    echo.
)

:: ============================================================
:: 5. Veritabani
:: ============================================================
if not exist "prisma\dev.db" (
    echo  [3/3] Veritabani olusturuluyor...
    call npx prisma db push --accept-data-loss
    if errorlevel 1 (
        echo.
        echo  [HATA] Veritabani olusturulamadi!
        pause
        exit /b 1
    )
    echo  [OK] Veritabani olusturuldu.
    echo.
    echo  [BILGI] Ornek veriler yukleniyor...
    call npx tsx prisma/seed.ts
    echo  [OK] Ornek veriler yuklendi.
    echo.
)

:: ============================================================
:: 6. Public Dosyalari
:: ============================================================
if exist "scripts\copy-public.js" (
    node scripts\copy-public.js >nul 2>nul
)

:: ============================================================
:: Masaustu kisayolu olustur
:: ============================================================
call :kisayol_olustur

:: ============================================================
:: 7. Secenek Menusu
:: ============================================================
cls
echo.
echo  ============================================================
echo    MagazaPOS Hazir!
echo  ============================================================
echo.
echo    [1] Hizli Baslat   ^(Gelistirici Modu - Tavsiye Edilen^)
echo    [2] EXE Paketi Olustur ^(electron-builder ile .exe^)
echo.
echo  ============================================================
echo.
set /p "SECIM=  Seciminiz (1 veya 2): "

if "%SECIM%"=="2" goto :exe_paketle
goto :hizli_baslat

:: ============================================================
:hizli_baslat
:: ============================================================
echo.
echo  [BILGI] MagazaPOS baslatiliyor...
echo  Uygulamayi durdurmak icin bu pencereyi kapatin.
echo.
call npm run dev
if errorlevel 1 (
    echo.
    echo  [HATA] npm run dev basarisiz oldu! Hata kodu: %errorlevel%
)
echo.
pause
exit /b

:: ============================================================
:exe_paketle
:: ============================================================
echo.
echo  ============================================================
echo    EXE Paketi Olusturuluyor...
echo    Bu islem 5-10 dakika surebilir. Lutfen bekleyin.
echo  ============================================================
echo.

echo  [1/3] TypeScript derleniyor...
call npx tsc --skipLibCheck
if errorlevel 1 (
    echo  [UYARI] TypeScript hatalari var ama devam ediliyor...
)

echo  [2/3] Vite build yapiliyor...
call npx vite build
if errorlevel 1 (
    echo.
    echo  [HATA] Vite build basarisiz oldu!
    pause
    exit /b 1
)

echo  [3/3] Electron paketi olusturuluyor...
call npx electron-builder --win nsis --publish never
if errorlevel 1 (
    echo.
    echo  [HATA] electron-builder basarisiz oldu!
    echo  Hata detaylari yukarida gorulabilir.
    pause
    exit /b 1
)

echo.
echo  ============================================================
echo    [BASARILI] EXE Paketi Olusturuldu!
echo    release\ klasorunu kontrol edin.
echo  ============================================================
echo.

:: Olusturulan EXE'yi baslat
if exist "release\win-unpacked" (
    for %%F in ("release\win-unpacked\*.exe") do (
        echo  [BILGI] MagazaPOS baslatiliyor: %%~nxF
        start "" "%%~fF"
        exit /b 0
    )
)

pause
exit /b 0

:: ============================================================
:kisayol_olustur
:: ============================================================
set "VBS_TEMP=%TEMP%\mpos_lnk_%RANDOM%.vbs"
set "HEDEF=%~dp0MagazaPosKurulum.bat"
set "IKON=%~dp0public\icon.ico"

:: EXE varsa kisayol direkt EXE'ye gitsin
if exist "release\win-unpacked" (
    for %%F in ("release\win-unpacked\*.exe") do (
        set "HEDEF=%%~fF"
    )
)

for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "MASAUSTU=%%D"
if not defined MASAUSTU goto :eof

(
    echo Set ws = CreateObject("WScript.Shell"^)
    echo Set lnk = ws.CreateShortcut("%MASAUSTU%\MagazaPOS.lnk"^)
    echo lnk.TargetPath = "%HEDEF%"
    echo lnk.WorkingDirectory = "%~dp0"
    echo lnk.Description = "MagazaPOS Kasa ve Stok Yonetim Sistemi"
    echo lnk.WindowStyle = 1
    if exist "%IKON%" echo lnk.IconLocation = "%IKON%, 0"
    echo lnk.Save
) > "%VBS_TEMP%"

cscript //nologo "%VBS_TEMP%" >nul 2>&1
del "%VBS_TEMP%" >nul 2>&1
echo  [OK] Masaustune kisayol olusturuldu.
goto :eof