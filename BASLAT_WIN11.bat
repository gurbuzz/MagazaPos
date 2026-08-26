@echo off
chcp 65001 > nul
title MağazaPOS - Kasa ve Stok Sistemi Başlatıcı

echo ============================================================
echo 🏬 MağazaPOS Kasa ve Stok Yönetim Sistemi Başlatılıyor...
echo ============================================================
echo.

:: Statik mobil kaynakları kopyala
if not exist "dist-electron\main\public" mkdir "dist-electron\main\public"
xcopy /Y /S "src\server\public\*" "dist-electron\main\public\" > nul

:: Geliştirme / Çalıştırma modunu başlat
npm run dev

pause
