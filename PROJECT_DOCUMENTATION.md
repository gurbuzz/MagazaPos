# POS ve Stok Yönetimi Sistemi - Proje Dokümantasyonu (V1.0)

> **Agent / Geliştirici Talimatı:** Bu döküman, Mağaza POS ve Stok Yönetimi Sistemi'nin mimarisini, teknoloji yığınını, donanım entegrasyonlarını ve modüler gereksinimlerini tanımlar. Proje üzerindeki tüm geliştirmeler bu dokümandaki ilkelere ve mimari yapıya sadık kalınarak gerçekleştirilmelidir.

---

## 1. Projenin Amacı ve Genel Mimari

Bu proje, giyim mağazalarının kasa (POS) işlemlerini, stok takibini, renk/beden varyant yönetimini ve tedarik/lojistik süreçlerini uçtan uca yönetmek üzere tasarlanmıştır.

### 1.1. Dağıtım ve Çalışma Modeli
* **Yerel Masaüstü Uygulaması (.exe):** Sistem, bulut sunucu veya dış internet bağımlılığı olmadan, mağaza içi ana bilgisayarda çalışan **bağımsız bir masaüstü uygulaması (.exe)** olarak kurulur ve işletilir.
* **Gizli Yerel Web Sunucusu (Hybrid Network Architecture):** Uygulama masaüstünde açıldığında arka planda otomatik olarak gömülü bir **Node.js & Express.js** web sunucusu başlatır.
* **Mobil Depo / Stok Kontrol Erişimi:** Aynı yerel Wi-Fi/LAN ağına bağlı cep telefonları veya tabletler, ana bilgisayarın yerel IP adresini (örneğin: `http://192.168.1.100:3000`) tarayıcılarına girerek sadece yetkilendirildikleri **Stok Görüntüleme ve Depo Yönetimi** ekranlarına anında erişebilirler.

```
+-------------------------------------------------------------------------+
|                         ANA BİLGİSAYAR (DESKTOP)                        |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | Electron.js Desktop App (.exe)                                    |  |
|  | +---------------------------------------------------------------+ |  |
|  | | Frontend: React + Tailwind CSS + Zustand (POS & Admin GUI)    | |  |
|  | +---------------------------------------------------------------+ |  |
|  | | Backend: Node.js & Express.js (Embedded Local Server)         | |  |
|  | +---------------------------------------------------------------+ |  |
|  +-------------------------------------------------------------------+  |
|                                  |                                      |
|                                  v                                      |
|                     PostgreSQL Database (Docker)                        |
+-------------------------------------------------------------------------+
                                   ^
                                   | (Wi-Fi / Yerel Ağ HTTP İstekleri)
             +---------------------+---------------------+
             |                                           |
             v                                           v
+--------------------------+               +--------------------------+
| Mobil Cihaz 1 (Telefon)  |               | Mobil Cihaz 2 (Tablet)   |
| (Stok Kontrol Arayüzü)   |               | (Stok Kontrol Arayüzü)   |
+--------------------------+               +--------------------------+
```

---

## 2. Teknoloji Yığını (Tech Stack)

| Katman | Teknoloji / Araç | Tercih Nedeni ve Sorumluluk |
| :--- | :--- | :--- |
| **Masaüstü Wrapper** | **Electron.js** | Web teknolojileriyle (HTML/JS/React) Windows için tam yetkili, bağımsız bir masaüstü (.exe) paketlemek. Donanımlara (yazıcılar, seri portlar) doğrudan erişim. |
| **Arayüz (Frontend)** | **React, Tailwind CSS, Zustand** | Kasa personelinin hızını kesmeyecek anlık tepki veren, sade, modern arayüz. Zustand ile sepet (POS) ve uygulama durumunu (state) performanslı yönetme. |
| **Sunucu (Backend)** | **Node.js & Express.js** | Electron süreci içinde/yanında çalışarak mobil cihazlardan gelen yerel ağ HTTP isteklerini karşılar ve veritabanı işlemlerini yürütür. |
| **Veritabanı** | **PostgreSQL (Docker)** | Giyim sektöründeki esnek renk/beden varyant karmaşasını `JSONB` sütun tipleriyle yönetmek. Konfigürasyon kolaylığı için Docker container olarak çalışır. |

---

## 3. Donanım Entegrasyonu Standartları

### 3.1. Barkod Okuyucu Entegrasyonu (Global HID Listener)
* **Çalışma Prensibi:** Barkod okuyucular standart bir klavye (Human Interface Device - HID) gibi davranır ve seriyi hızlı tuş vuruşları olarak aktarır.
* **Yazılımsal Çözüm:** 
  * POS ekranı açıkken odak (focus) nerede olursa olsun, global bir tuş dinleyici (keylistener) veya otomatik odaklanan gizli bir input alanı sayesinde okutulan barkod anında yakalanır.
  * Okunan barkod eşleşen ürün varyantını otomatik olarak **POS sepetine** ekler ve stoktan düşecek şekilde hazırlar.

### 3.2. Etiket ve Fiş Yazıcısı Entegrasyonu (Silent/RAW Print)
* **Çalışma Prensibi:** Etiket basım işlemlerinde tarayıcı yazdırma iletişim kutusunun (print dialog popup) çıkması operasyonel hızı yavaşlatır.
* **Yazılımsal Çözüm:**
  * Electron.js `webContents.print()` API'si veya varsayılan thermal printer kütüphaneleri kullanılarak **Sessiz Yazdırma (Silent Print)** gerçekleştirilir.
  * Termal etiket yazıcılarına veri doğrudan RAW formatta veya önceden tanımlanmış etiket şablonları (ZPL / ESC/POS veya HTML-to-Printer) üzerinden arka planda iletilir.

---

## 4. Temel Modüller ve İşlevsel Gereksinimler

### 4.1. Kasa ve POS Modülü
* **Hızlı Barkodlu Satış:** Barkod okutulduğunda ürün varyantı sepete eklenir, miktar anlık güncellenir.
* **Parçalı Tahsilat (Split Payment):** Nakit, Kredi Kartı veya Açık Hesap/Hediye Çeki combinations ile parçalı ödeme alma.
* **Sepet Altı İndirim ve Kampanya Motoru:** 
  * Oransal (%) veya tutarsal (TL) sepet altı indirimi.
  * Giyim sektörüne özel esnek kampanya kuralları (Örn: *"3 Al 2 Öde"*, *"İkinci Ürüne %50 İndirim"* vb.).
* **Hızlı İade ve Değişim:** Satış fişi/faturası üzerinden hızlı ürün iadesi ve fark tahsilatı.

### 4.2. Stok, Depo ve Varyant Yönetimi
* **Ana Ürün & SKU Hiyerarşisi:**
  * Products (Ana Ürün): Örn. *"Erkek Boğazlı Kazak"*, Genel Ürün Kodu, Kategori, Marka, Genel Açıklama.
  * Variants (Alt Ürün/SKU): Örn. *"Renk: Kırmızı, Beden: M"*, Özel SKU, Özel Barkod, Alış/Satış Fiyatı, Stok Adedi.
* **JSONB ile Dinamik Varyantlar:** Renk, beden, kumaş tipi, cinsiyet gibi öznitelikler PostgreSQL JSONB sütunlarında tutularak sınırsız ve esnek varyant kombinasyonu sağlanır.
* **Mobil Stok Kontrol Arayüzü:**
  * Reyondaki personel cep telefonundan `http://[IP]:[PORT]/mobile` adresine bağlanır.
  * Ürün adı veya barkod ile arama yaparak hangi bedenin depoda kaç adet kaldığını kasaya gitmeden anında görür.

### 4.3. Satın Alma, Lojistik ve İrsaliye
* **Tedarikçi Girişleri:** Tedarikçilerden gelen yeni sezon ürünlerin irsaliye/fatura bilgilerinin sisteme aktarılması.
* **Toplu Etiket Basımı:** Yeni girilen stoklar için istenilen adette barkod ve raf etiketi şablonu oluşturma ve termal yazıcıya toplu gönderme.

---

## 5. Veritabanı Tasarım Esasları (PostgreSQL)

### 5.1. Ana Tablo Yapıları (Örnek Şema Mantığı)
1. `products` (Ana Ürünler): `id`, `name`, `category_id`, `brand`, `base_price`, `description`, `created_at`
2. `product_variants` (Varyantlar/SKU): `id`, `product_id`, `sku`, `barcode`, `attributes` (JSONB: `{"color": "Kırmızı", "size": "M"}`), `cost_price`, `sale_price`, `stock_quantity`
3. `sales` (Satışlar): `id`, `receipt_no`, `total_amount`, `discount_amount`, `payment_type` (JSONB: `{"cash": 100, "card": 200}`), `status`, `created_at`
4. `sale_items` (Satış Detayı): `id`, `sale_id`, `variant_id`, `quantity`, `unit_price`, `total_price`
5. `stock_movements` (Stok Hareketleri): `id`, `variant_id`, `movement_type` (IN, OUT, ADJUSTMENT, SALE, RETURN), `quantity`, `note`, `created_at`

---

## 6. Örnek Kullanım Senaryosu (User Flow)

1. **Açılış:** Mağaza yetkilisi Windows bilgisayarı açar, masaüstündeki `MağazaPOS` ikonuna tıklar.
2. **Başlatma:** Electron.js penceresi açılır ve Kasa (POS) ekranı yüklenir. Eşzamanlı olarak arka planda Node.js Express sunucusu `3000` portundan yayına başlar.
3. **Kasa İşlemi:** Müşteri kasaya gelir. Personel barkod okuyucu ile ürünleri okutur, sepete düşer. Parçalı ödeme alınıp satış tamamlanır. Otomatik fiş/etiket yazdırılır.
4. **Reyon / Depo İşlemi:** Müşteri reyonda farklı bir beden sorar. Satış temsilcisi telefonundan `http://192.168.1.100:3000/mobile` adresini açar, ürünü aratarak depodaki stoğu söyler.

---

## 7. AI Agent İçin Çalışma Talimatları ve Prensipler

Geliştirici veya AI Agent proje üzerinde kod yazarken şu ilkelere UYMALIDIR:

1. **Modüler Mimari:** Frontend React bileşenleri sade, atomic design prensiplerine uygun olmalı; sepet yönetimi Zustand store'larında tutulmalıdır.
2. **Barkod Hızı:** POS arayüzünde klavye ve barkod okuyucu odaklanma sorunları yaşanmamalıdır.
3. **Esnek JSONB Varyantları:** Varyant tablosunda sabit kolonlar yerine renk/beden esnekliği JSONB yapısında korunmalıdır.
4. **Sessiz Yazdırma:** Etiket ve fiş yazıcı çıktıları Electron ana süreci (main process) üzerinden silent print mekanizmasıyla tetiklenmelidir.
5. **Çoklu Cihaz Desteği:** Mobil web arayüzü responsive ve hafif olmalı, yerel ağ erişimlerinde düşük gecikmeyle çalışmalıdır.
