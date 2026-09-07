@echo off
chcp 65001 >nul 2>nul
title MagazaPOS - Kasa ve Stok Yonetim Sistemi
REM Pencere kapanmasin - kendini /k ile yeniden ac
if "%1"=="--run" goto BASLAT
cmd.exe /k "%~f0" --run
exit

:BASLAT
cd /d "%~dp0"
cls
echo.
echo  ============================================================
echo    MagazaPOS - Kasa ve Stok Yonetim Sistemi
echo  ============================================================
echo.

REM --- Node.js Kontrol ---
echo  [KONTROL] Node.js araniyor...
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo  [HATA] Node.js bulunamadi!
    echo  https://nodejs.org adresinden Node.js LTS indirin.
    echo.
    pause
    goto BITIS
)
echo  [OK] Node.js bulundu:
call node -v
echo.

REM --- .env Dosyasi ---
if not exist ".env" (
    echo  [BILGI] .env dosyasi olusturuluyor...
    echo DATABASE_URL="file:./dev.db"> ".env"
    echo PORT=3782>> ".env"
    echo  [OK] .env olusturuldu.
    echo.
)

REM --- npm install ---
if not exist "node_modules" (
    echo  [1/4] Paketler yukleniyor - npm install...
    echo  Bu islem birkac dakika surebilir, lutfen bekleyin...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo  [HATA] npm install basarisiz!
        pause
        goto BITIS
    )
    echo.
    echo  [OK] npm install tamamlandi.
    echo.
)

REM --- Prisma Generate (her zaman kontrol et) ---
if not exist "node_modules\.prisma\client" (
    echo  [2/4] Prisma istemcisi hazirlaniyor...
    call npx prisma generate
    if errorlevel 1 (
        echo  [HATA] prisma generate basarisiz!
        pause
        goto BITIS
    )
    echo  [OK] Prisma istemcisi hazir.
    echo.
) else (
    echo  [OK] Prisma istemcisi mevcut.
)

REM --- Veritabani ---
if not exist "prisma\dev.db" (
    echo  [3/4] Veritabani olusturuluyor...
    call npx prisma db push --accept-data-loss
    if errorlevel 1 (
        echo  [HATA] Veritabani olusturulamadi!
        pause
        goto BITIS
    )
    echo  [OK] Veritabani olusturuldu.
    echo.
    echo  [4/4] Ornek veriler yukleniyor...
    call npx tsx prisma/seed.ts
    echo  [OK] Ornek veriler yuklendi.
    echo.
) else (
    echo  [OK] Veritabani mevcut.
)

REM --- Public dosyalari kopyala ---
if exist "scripts\copy-public.js" (
    call node scripts\copy-public.js >nul 2>nul
)

REM --- Masaustu Kisayolu ---
echo  [BILGI] Masaustu kisayolu olusturuluyor...
set "VBS_TEMP=%TEMP%\mpos_lnk.vbs"
set "HEDEF=%~dp0MagazaPosKurulum.bat"
set "IKON=%~dp0public\icon.ico"
if exist "release\win-unpacked" (
    for %%F in ("release\win-unpacked\*.exe") do set "HEDEF=%%~fF"
)
for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "MASAUSTU=%%D"
if defined MASAUSTU (
    echo Set ws = CreateObject^("WScript.Shell"^)> "%VBS_TEMP%"
    echo Set lnk = ws.CreateShortcut^("%MASAUSTU%\MagazaPOS.lnk"^)>> "%VBS_TEMP%"
    echo lnk.TargetPath = "%HEDEF%">> "%VBS_TEMP%"
    echo lnk.WorkingDirectory = "%~dp0">> "%VBS_TEMP%"
    echo lnk.Description = "MagazaPOS">> "%VBS_TEMP%"
    echo lnk.WindowStyle = 1>> "%VBS_TEMP%"
    echo lnk.Save>> "%VBS_TEMP%"
    cscript //nologo "%VBS_TEMP%" >nul 2>&1
    del "%VBS_TEMP%" >nul 2>&1
    echo  [OK] Masaustu kisayolu olusturuldu.
) else (
    echo  [UYARI] Masaustu yolu bulunamadi, kisayol olusturulamadi.
)
echo.

REM --- Menu ---
echo  ============================================================
echo    MagazaPOS Hazir! Ne yapmak istiyorsunuz?
echo  ============================================================
echo.
echo    [1] Hizli Baslat (Gelistirici Modu)
echo    [2] EXE Paketi Olustur (electron-builder)
echo.
echo  ============================================================
echo.
set /p SECIM="  Seciminiz (1 veya 2): "

if "%SECIM%"=="2" goto EXE_PAKETLE
goto HIZLI_BASLAT

:HIZLI_BASLAT
echo.
echo  [BILGI] MagazaPOS baslatiliyor...
echo  Kapatmak icin bu pencereyi kapatin veya Ctrl+C basin.
echo.
call npm run dev
echo.
echo  [BILGI] MagazaPOS kapandi.
pause
goto BITIS

:EXE_PAKETLE
echo.
echo  ============================================================
echo    EXE Paketi Olusturuluyor...
echo    Bu islem 5-10 dakika surebilir.
echo  ============================================================
echo.

REM Code signing devre disi birak (sertifika yok, symlink hatasi onlenir)
set CSC_IDENTITY_AUTO_DISCOVERY=false
set WIN_CSC_LINK=
set DEBUG=electron-builder

REM Sorunlu winCodeSign cache temizle (symlink hatasi kaynagi)
if exist "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" (
    echo  [BILGI] Sorunlu winCodeSign cache temizleniyor...
    rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" >nul 2>&1
    echo  [OK] Cache temizlendi.
)

echo  [1/3] TypeScript derleniyor...
call npx tsc --skipLibCheck
echo  [2/3] Vite build yapiliyor...
call npx vite build
if errorlevel 1 (
    echo  [HATA] Vite build basarisiz!
    pause
    goto BITIS
)
echo  [3/3] Electron paketi olusturuluyor (imzasiz)...
call npx electron-builder --win nsis --publish never --config.win.signAndEditExecutable=false
if errorlevel 1 (
    echo  [HATA] electron-builder basarisiz!
    pause
    goto BITIS
)
echo.
echo  ============================================================
echo    [BASARILI] EXE Paketi Olusturuldu!
echo  ============================================================
echo.

REM Masaustunu bul
for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "MASA=%%D"

REM Setup installer'i masaustune kopyala
if defined MASA (
    for %%F in ("release\*.exe") do (
        echo  [BILGI] Kurulum dosyasi masaustune kopyalaniyor: %%~nxF
        copy /y "%%~fF" "%MASA%\%%~nxF" >nul 2>&1
        echo  [OK] Masaustune kopyalandi: %MASA%\%%~nxF
    )
)

REM Masaustu kisayolunu EXE'ye guncelle
if exist "release\win-unpacked" (
    for %%F in ("release\win-unpacked\*.exe") do (
        set "EXE_YOL=%%~fF"
        if defined MASA (
            set "VBS2=%TEMP%\mpos_exe_lnk.vbs"
            echo Set ws = CreateObject^("WScript.Shell"^)> "%TEMP%\mpos_exe_lnk.vbs"
            echo Set lnk = ws.CreateShortcut^("%MASA%\MagazaPOS.lnk"^)>> "%TEMP%\mpos_exe_lnk.vbs"
            echo lnk.TargetPath = "%%~fF">> "%TEMP%\mpos_exe_lnk.vbs"
            echo lnk.WorkingDirectory = "%~dp0">> "%TEMP%\mpos_exe_lnk.vbs"
            echo lnk.Description = "MagazaPOS Kasa ve Stok Yonetim">> "%TEMP%\mpos_exe_lnk.vbs"
            echo lnk.WindowStyle = 1>> "%TEMP%\mpos_exe_lnk.vbs"
            echo lnk.Save>> "%TEMP%\mpos_exe_lnk.vbs"
            cscript //nologo "%TEMP%\mpos_exe_lnk.vbs" >nul 2>&1
            del "%TEMP%\mpos_exe_lnk.vbs" >nul 2>&1
            echo  [OK] Masaustu kisayolu EXE'ye guncellendi.
        )
        echo.
        echo  [BILGI] MagazaPOS simdi baslatiliyor...
        start "" "%%~fF"
    )
)

echo.
echo  Masaustunuzdeki dosyalar:
echo    - MagazaPOS.lnk   (Kisayol - cift tikla calistir)
echo    - Setup .exe       (Kurulum dosyasi - baska bilgisayara kurmak icin)
echo.
pause
goto BITIS

:BITIS
echo.
echo  Pencereyi kapatmak icin exit yazin veya capraz tusuna basin.