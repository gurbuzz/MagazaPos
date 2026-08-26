@echo off
chcp 65001 > nul
title MağazaPOS - Windows 11 Otomatik Kurulum Sihirbazı

echo ============================================================
echo 🚀 MağazaPOS - Windows 11 Otomatik Kurulum Başlatılıyor...
echo ============================================================
echo.

:: 1. NPM Bağımlılıkları
echo [1/3] Yazılım Bağımlılıkları Yükleniyor...
call npm install

:: 2. Gömülü SQLite Veritabanı ve Seed Yükleme
echo.
echo [2/3] Yerel SQLite Veritabanı Hazırlanıyor ve Örnek Ürünler Yükleniyor...
call npx prisma db push
call npx tsx prisma/seed.ts

:: 3. Masaüstü Kurulum Dosyası (.exe) Üretme
echo.
echo [3/3] Windows 11 Tek Tık Kurulum Dosyası (.exe) Derleniyor...
call npm run package:win

echo.
echo ============================================================
echo 🎉 TEBRİKLER! MağazaPOS Kurulum Paketiniz Başarıyla Üretildi!
echo 📁 Windows Kurulum Dosyası: release\MağazaPOS Setup 1.0.0.exe
echo ℹ️ Bu .exe dosyasını mağaza bilgisayarına kopyalayıp tek tıkla kurabilirsiniz.
echo ============================================================
echo.
pause
