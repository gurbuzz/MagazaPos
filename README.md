# 🏬 MağazaPOS - Mağaza İçi Kasa & Stok Yönetim Sistemi

MağazaPOS, giyim ve tekstil mağazaları için özel olarak geliştirilmiş; **Yerel Masaüstü POS Kasa**, **Barkod/Etiket Basımı**, **Mobil Wi-Fi Stok Kontrolü** ve **Tek Tıkla Windows 11 Kurulumu** sunan bağımsız bir masaüstü yazılımıdır.

---

## 🚀 Windows 11 Sıfır Kurulum (Zero-Dependency)
Mağaza bilgisayarında **Docker Desktop veya ekstra hiçbir program yüklemeden** tek tıkla çalıştırma:

1. **`KURULUM_WIN11.bat`**: Çift tıklayarak bağımlılıkları yükler, gömülü SQLite veritabanını oluşturur ve `release/MağazaPOS Setup 1.0.0.exe` kurulum paketini üretir.
2. **`MağazaPOS Setup 1.0.0.exe`**: Üretilen kurulum dosyasını mağaza bilgisayarına taşıyıp çift tıklayarak **harici hiçbir gereksinim olmadan** masaüstü simgesiyle kullanabilirsiniz.

---

## 💻 Özet Özellikler
- **Masaüstü Uygulaması (.exe):** Electron.js ve yerel gömülü SQLite veritabanı ile Windows 11 bilgisayarında bağımsız masaüstü ikonu ile çalışma.
- **Tek Tıkla Windows Installer (.exe):** NSIS otomatik kurulum paketi (`release/MağazaPOS Setup 1.0.0.exe`).
- **Yerel Ağ Mobil Erişimi:** Gömülü Node.js web sunucusu ile Wi-Fi üzerinden telefon/tablet ile depodaki stokları anlık sorgulama.
- **Gelişmiş Varyant Yönetimi:** Renk ve beden kombinasyonları için JSON veri yapısı desteği.
- **Donanım Entegrasyonları:** Barkod okuyucu (HID) otomatik yakalama ve termal etiket/fiş için tarayıcı penceresiz sessiz yazdırma (Silent Print).
- **Z Raporu & Satış Geçmişi:** Nakit ve Kredi Kartı ciroları, geçmiş fiş detayları inceleme.

---

## 🛠️ Teknolojiler
- **Masaüstü & UI:** Electron.js, React 18, Vite, Tailwind CSS, Zustand, Lucide React.
- **Veritabanı:** Gömülü SQLite & Prisma ORM (`prisma/dev.db`).
- **Backend:** Node.js Express.
