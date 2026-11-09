# Windows güncelleme süreci

## Açılışta `Cannot find module 'electron-updater'` hatası

Bu hata, kurulu uygulamanın güncelleme modülünü içermediğini gösterir. Aynı modül kaynak klasöründeki `node_modules` içinde de eksikse TypeScript `TS2307` ve güncelleme olaylarında `TS7006` hataları verir.

Windows'ta güncel kaynak koduyla `Paketle_EXE.bat` dosyasını çalıştırın. Betik, her paketlemeden önce `npm ci --include=dev` ile kilit dosyasındaki bağımlılıkları kurar. Alternatif olarak kaynak klasöründe sırasıyla `npm ci --include=dev` ve `npm run package:win` çalıştırın. `release` klasöründe yeni oluşturulan kurulum dosyasını mevcut uygulamanın üzerine kurun. Kaynak klasöründe paketleri kurmak, daha önce oluşturulmuş EXE'yi düzeltmez. Mevcut mağaza veritabanını veya kullanıcı verileri klasörünü silmeyin.

`MagazaPosKurulum.bat` da bağımlılıkları aynı şekilde kurar ve TypeScript hatası varsa paketlemeyi durdurur.

## Yeni sürüm yayınlama

Güncelleme kaynağı `gurbuzz/MagazaPos` GitHub deposunun yayınlanmış Release kayıtlarıdır. Kaynak kodunu göndermek tek başına güncelleme yayınlamaz.

1. Paket ve veritabanı şablonunun paylaşılabilir olduğundan ve Git geçmişinde gizli bilgi bulunmadığından emin olun. Depoyu herkese açık yapmak bütün kodu ve geçmişi de açar; tekrar gizlemek daha önce indirilen kopyaları geri almaz.
2. `package.json` sürümünü mevcut kurulu sürümden yüksek bir sürüme yükseltin. Sürüm numaralarını tekrar kullanmayın.
3. Windows'ta `npm ci` ve `npm run package:win` çalıştırın. Kurulum dosyasını, `latest.yml` dosyasını ve oluşan `.blockmap` dosyasını aynı GitHub Release'e yükleyin. Release'i taslak veya ön sürüm olarak bırakmayın.
4. Depo herkese açıkken POS'ta Ayarlar → Güncelleme → Güncellemeleri Kontrol Et → Güncellemeyi İndir adımlarını uygulayın. İndirme tamamlanana kadar depo açık kalmalıdır.
5. Açık satışı tamamlayın veya sepeti temizleyin, ardından Yedekle ve Kur'u seçin. Kurulum sırasında Windows yönetici izni isteyebilir.
6. Güncelleme tamamlanınca uygulamanın açıldığını, satışları, stokları ve müşteri kayıtlarını kontrol edin. Ardından depoyu tekrar özel yapabilirsiniz.

İlk kez bu özelliği içeren sürümün normal kurulumla POS'a yüklenmesi gerekir. Güncelleme öncesi yedek kullanıcı verileri dizinindeki `backups` klasörüne alınır. Yedek doğrulanamazsa kurulum başlamaz. Yedekleme cihaz arızasına karşı bağımsız bir yedek yerine geçmez.

Şema değişiklikleri için henüz sürümlü veritabanı geçiş ve otomatik geri alma sistemi yoktur. Veritabanını değiştiren bir sürümü yayınlamadan önce mağaza verisinin kopyası üzerinde geçişi ve yedekten kurtarmayı test edin; gerekirse geçiş mekanizmasını ayrıca geliştirin. Eski uygulama sürümünü yeni şemaya karşı çalıştırmanın güvenli olduğunu varsaymayın.
