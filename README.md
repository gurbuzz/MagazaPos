# 🏬 MağazaPOS - Mağaza İçi Kasa & Stok Yönetim Sistemi

MağazaPOS, giyim ve tekstil mağazaları için özel olarak geliştirilmiş; **Yerel Masaüstü POS Kasa**, **Barkod/Etiket Basımı**, **Mobil Wi-Fi Stok Kontrolü** ve **Tek Tıkla Windows 11 Kurulumu** sunan bağımsız bir masaüstü yazılımıdır.

---

## 🚀 Windows 11 Kurulum ve Çalıştırma Rehberi

MağazaPOS, mağazanızdaki bilgisayarda ister sıfır kurulumla (portable), ister installer ile, ister kaynak kod üzerinden pratik bir şekilde çalıştırılabilir.

---

### Yöntem 1: Kurulumsuz Doğrudan Çalıştırma (Tavsiye Edilen - Sıfır Bağımlılık)

Mağaza bilgisayarında **Node.js, komut satırı veya harici hiçbir paket kurmadan**, tamamen bağımsız olarak çalıştırmak için en kolay yöntemdir:

1. **Dosyaları Hazırlayın:**
   * `release/MagazaPOS_Windows11_Kurulumsuz.zip` arşivini açın veya `release/win-unpacked` klasörünü mağaza bilgisayarına (örneğin `C:\MagazaPOS` veya Masaüstüne) kopyalayın.
2. **Programı Başlatın:**
   * Klasörün içerisindeki **`MağazaPOS.exe`** veya **`BASLAT.bat`** dosyasına çift tıklayın.
   * Program birkaç saniye içinde açılacaktır.
3. **Masaüstü Kısayolu Oluşturma (İsteğe Bağlı):**
   * `MağazaPOS.exe` dosyasına sağ tıklayıp **Gönder > Masaüstü (kısayol oluştur)** seçeneğini kullanarak masaüstünüze kısayol simgesi yerleştirebilirsiniz.

> [!TIP]
> Bu sürüm taşınabilirdir (portable). Flash belleğe atıp dilediğiniz Windows 10/11 bilgisayarda doğrudan çalıştırabilirsiniz.

---

### Yöntem 2: Tek Tıkla Windows Installer (.exe ile Kurulum)

Standart bir Windows programı gibi kurulum sihirbazıyla kurmak isterseniz:

1. `release/MağazaPOS Setup 1.0.0.exe` dosyasını çalıştırın.
2. Kurulum sihirbazı otomatik olarak programı `Program Files` altına yükleyecek, Başlat Menüsüne ve Masaüstüne **MağazaPOS** kısayolunu ekleyecektir.
3. Masaüstündeki simgeye tıklayarak hemen kullanmaya başlayabilirsiniz.

---

### Yöntem 3: Kaynak Koddan Çalıştırma ve Geliştirme (.bat ile)

Yazılımı kaynak kod üzerinden çalıştırmak veya özelleştirmek isterseniz:

1. **Ön Koşul:** Bilgisayarda **Node.js (LTS sürümü)** kurulu olmalıdır: [nodejs.org](https://nodejs.org/)
2. **İlk Kurulum (Otomatik Sihirbaz):**
   * Proje ana klasöründeki **`KURULUM_WIN11.bat`** dosyasına çift tıklayın.
   * Bu betik; `npm install` bağımlılıklarını kurar, SQLite veritabanı şemasını hazırlar, örnek başlangıç ürünlerini yükler ve dosyaları derler.
3. **Sistemi Başlatma:**
   * Kurulum tamamlandıktan sonra her zaman **`BASLAT_WIN11.bat`** dosyasına çift tıklayarak sistemi başlatabilirsiniz.

---

## 🛡️ Windows 11 İpuçları ve Sorun Giderme

### 1. Microsoft Defender SmartScreen Uyarısı
İmzalanmamış yerel masaüstü uygulamalarında Windows 11 ilk açılışta mavi renkli **"Windows kişisel bilgisayarınızı korudu"** uyarısı verebilir:
* Çözüm: Penceredeki **"Ek bilgi" (More info)** bağlantısına tıklayın, ardından altta çıkan **"Yine de çalıştır" (Run anyway)** butonuna basın. Bu işlem yalnızca ilk çalıştırmada bir defa sorulur.

### 2. Windows Güvenlik Duvarı (Firewall) İzni
Program ilk açıldığında yerel ağ sunucusu (mobil barkod ve stok erişimi) için Windows Güvenlik Duvarı onay penceresi açabilir:
* Çözüm: **"Özel ağlar" (Ev veya iş yeri ağı)** seçeneğini işaretleyip **"Erişime izin ver"** butonuna tıklayın. Böylece aynı Wi-Fi'deki telefon ve tabletler kasaya bağlanabilir.

### 3. Varsayılan Yönetici PIN Kodu
* Sistem güvenlik kilidi ve admin ayarları için varsayılan PIN: **`1234`**
* PIN kodunu programın sağ üst köşesindeki ayarlar menüsünden dilediğiniz zaman değiştirebilirsiniz.

---

## 📱 Yerel Ağ Mobil Barkod ve Stok Terminali

Mağaza içindeki telefon veya tableti el terminali olarak kullanabilirsiniz:

1. Telefon/tabletinizi kasa bilgisayarı ile **aynı Wi-Fi ağına** bağlayın.
2. MağazaPOS üst menüsündeki **Mobil / Wi-Fi** simgesine tıklayın ve ekranda beliren **QR Kodu** telefonunuzun kamerasıyla okutun (veya tarayıcıya `http://<KASA-IP>:3001` adresini yazın).
3. Telefonunuzun kamerasını kullanarak ürün barkodlarını okutabilir, reyon veya depodaki anlık stok miktarını, renk/beden varyantlarını görüntüleyebilirsiniz.

---

## 🖨️ Donanım & Çevre Birimleri Desteği

* **Barkod Okuyucu:** USB veya kablosuz tüm standart HID klavye modundaki barkod okuyucular ile tak-çalıştır uyumludur. Herhangi bir sürücüye ihtiyaç duymaz.
* **Termal Fiş ve Etiket Yazıcıları:** ESC/POS uyumlu 58mm / 80mm fiş yazıcıları ve Xprinter / Argox gibi termal etiket yazıcıları doğrudan desteklenir. Ayarlar menüsünden sessiz yazdırma (Silent Print) ve varsayılan cihaz seçimi yapılabilir.
* **Veri Yedekleme (Offline-First):** Veriler tamamen yerel `prisma/dev.db` SQLite veritabanında saklanır; internet kesintilerinden etkilenmez. Düzenli yedek için `prisma/dev.db` dosyasını harici bir diske veya buluta kopyalamanız yeterlidir.

---

## 💻 Özet Özellikler
- **Masaüstü Uygulaması (.exe):** Electron.js ve yerel gömülü SQLite veritabanı ile Windows 11 bilgisayarında bağımsız masaüstü ikonu ile çalışma.
- **Tek Tıkla Windows Installer (.exe):** NSIS otomatik kurulum paketi (`release/MağazaPOS Setup 1.0.0.exe`).
- **Kurulumsuz Taşınabilir Sürüm (Portable):** Kurulum gerektirmeyen hazır paket (`release/win-unpacked`).
- **Yerel Ağ Mobil Erişimi:** Gömülü Node.js web sunucusu ile Wi-Fi üzerinden telefon/tablet ile depodaki stokları anlık sorgulama ve mobil kamera ile barkod tarama.
- **Gelişmiş Varyant Yönetimi:** Renk ve beden kombinasyonları için JSON veri yapısı desteği.
- **Toplu Excel İçe / Dışa Aktarım:** Excel şablonu ile binlerce ürünü tek tıkla yükleme veya dışa aktarma.
- **İade ve Değişim Yönetimi:** Sıfır farkla değişim ve fiş/barkod ile müşteri kaydı gerektirmeyen anonim iade desteği.
- **Hızlı Mal Kabul:** Barkod okutarak hızlı stok girişi yapabilme.
- **Z Raporu & Satış Geçmişi:** Nakit ve Kredi Kartı ciroları, geçmiş fiş detayları inceleme.

---

## 🛠️ Teknolojiler
- **Masaüstü & UI:** Electron.js, React 18, Vite, Tailwind CSS, Zustand, Lucide React.
- **Veritabanı:** Gömülü SQLite & Prisma ORM (`prisma/dev.db`).
- **Backend Servisleri:** Node.js Express.
