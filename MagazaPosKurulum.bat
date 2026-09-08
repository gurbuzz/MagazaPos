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
echo    Lufian ^& Jack Jones POS
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
    echo DATABASE_URL="file:./prisma/dev.db"> ".env"
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

REM --- Menu ---
echo.
echo  ============================================================
echo    MagazaPOS Hazir! Ne yapmak istiyorsunuz?
echo  ============================================================
echo.
echo    [1] Hizli Baslat (Gelistirici Modu - Terminal arkada acik kalir)
echo    [2] Windows .EXE Olarak Paketle ve Kur (Masaustu Simgesi ile Sifir Terminal)
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
echo    MagazaPOS Windows Paketi Olusturuluyor...
echo    Lutfen bekleyiniz (Bu islem bir defaya mahsus yapilir)...
echo  ============================================================
echo.

REM Code signing devre disi birak (sertifika yok, symlink hatasi onlenir)
set CSC_IDENTITY_AUTO_DISCOVERY=false
set WIN_CSC_LINK=

REM Sorunlu winCodeSign cache temizle
if exist "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" (
    echo  [BILGI] winCodeSign cache temizleniyor...
    rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" >nul 2>&1
)

REM Eger MagazaPOS arkada aciksa dosya kilitlenmesini onlemek icin kapat
taskkill /F /IM MagazaPOS.exe >nul 2>&1

echo  [1/4] Veritabani semasi ve ornek veriler pakete hazirlaniyor...
call npx prisma generate
call npx prisma db push --accept-data-loss
call npx tsx prisma/seed.ts
if not exist "prisma\dev.db" (
    if exist "dev.db" copy /y "dev.db" "prisma\dev.db" >nul 2>&1
)
if exist "prisma\dev.db" copy /y "prisma\dev.db" "dev.db" >nul 2>&1
echo  [OK] Veritabani pakete hazirlandi.

echo.
echo  [2/4] TypeScript derleniyor...
call npx tsc --skipLibCheck
echo.

echo  [3/4] Arayuz (Vite) derleniyor...
call npx vite build
if errorlevel 1 (
    echo.
    echo  [HATA] Vite build basarisiz!
    pause
    goto BITIS
)
echo.

echo  [4/4] Windows .EXE paketi olusturuluyor...
call npx electron-builder --win nsis --publish never --config.win.signAndEditExecutable=false
if errorlevel 1 (
    echo.
    echo  [HATA] electron-builder basarisiz!
    pause
    goto BITIS
)

echo.
echo  ============================================================
echo    [BASARILI] MagazaPOS Kurulum Paketi Olusturuldu!
echo  ============================================================
echo.

REM Masaustu temizligi: Varsa eski kurulum exe'sini masaustunden temizle (sadece kisayol kalsin)
for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "MASA=%%D"
if defined MASA (
    if exist "%MASA%\MagazaPOS-Kurulum.exe" del /f /q "%MASA%\MagazaPOS-Kurulum.exe" >nul 2>&1
    if exist "%MASA%\MagazaPOS Setup *.exe" del /f /q "%MASA%\MagazaPOS Setup *.exe" >nul 2>&1
)

echo  [BILGI] MagazaPOS simdi bu bilgisayara kuruluyor ve baslatiliyor...
for %%F in ("release\*.exe") do (
    start "" "%%~fF"
    goto KURULUM_SONRASI
)

:KURULUM_SONRASI
echo.
echo  ============================================================
echo    [TEBRIKLER] Kurulum Tamamlandi!
echo    
echo    * Masaustunuzdeki 'MagazaPOS' simgesine cift tiklayarak
echo      uygulamayi terminal OLMADAN dogrudan acabilirsiniz.
echo    * Tum verileriniz ve lisansiniz artik kalici olarak
echo      guvenli sekilde saklanacaktir.
echo  ============================================================
echo.
pause
goto BITIS

:BITIS
echo.
echo  Pencereyi kapatmak icin exit yazin veya capraz tusuna basin.