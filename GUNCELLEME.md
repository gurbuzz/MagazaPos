# Windows güncelleme süreci

## Hediye çeki sürümüne geçiş ve kullanım

`MagazaPosKurulum.bat` artık `db push --accept-data-loss` veya örnek veri yükleme çalıştırmaz. Her seferinde aynı betikle paketleme yapabilirsiniz; mevcut kullanıcı verileri dizinini, mağaza veritabanını ve lisans dosyalarını silmeyin. İlk kurulumda uygulama mevcut şablondan veritabanı oluşturur; sonraki açılışlarda kalıcı mağaza veritabanını kullanır. `prisma/seed.ts` dolu bir veritabanına örnek veri yüklemeyi reddeder.

Hediye çeki tabloları ilk açılışta eklenir. Önce SQLite bütünlüğü denetlenir, tutarlı bir yedek alınır ve ayrı bağlantıyla doğrulanır. Yedek alınamazsa işlem yapılmaz ve API satış kabul etmez. `GiftVoucher` ve `GiftVoucherMovement` tabloları tek işlemde eklenir; mevcut satış, ürün, stok ve müşteri tabloları bu geçişte yeniden oluşturulmaz veya temizlenmez. Geçiş yedeği kullanıcı verileri dizinindeki `backups/hediye_oncesi_*.db` konumundadır ve rutin yedek temizliği bu dosyaları silmez.

Mağazada ilk uygulamadan önce Ayarlar → Veritabanı & Yedek bölümünden yedek indirip başka bir cihazda saklayın. Mağaza verisinin bir kopyasında yükseltmeyi doğrulayın; testler örnek kayıtlarla yapılır, Windows cihazındaki gerçek verilerin testi yerine geçmez. İlk açılışta eski kayıtları, stokları ve satışları kontrol edin. Eski yedeğe dönmek, o yedekten sonra oluşturulan çek ve satışları da geri alır; işlem yapmaya başladıktan sonra eski yedeği doğrudan yüklemeyin.

Navbar’daki hediye simgesiyle **Çek Oluştur** veya **Sorgula / Tekrar Yazdır** açılır. Nakit/kart karşılığı çekler ve yönetici PIN’iyle mağaza hediyeleri desteklenir. Kart seçimi banka terminalinden tahsilat yapmaz; önce tahsilatı tamamlayın. Oluşturma işlemi tekrar denendiğinde aynı işlem kimliği aynı çeki getirir. Yazıcı hatasında yeni çek oluşturmak yerine tekrar yazdırın. Bu sürümde çekler süresizdir ve nakit para üstü verilmez.

Ödeme ekranında **Hediye Çeki Kullan** alanına barkodu okutun, sorgulayın ve kullanılacak tutarı belirleyin. Kalan tutar nakit, kart veya parçalı ödeme ile tamamlanır. Çek bakiyesi satış ve stok hareketleriyle aynı veritabanı işleminde düşer. Kopya fiş ek bakiye oluşturmaz. İadelerde çekle ödenen pay çeke, nakit/kart payı başlangıç oranlarına göre geri döner. Çek oluşturma tahsilatları çek penceresinde ürün satışlarından ayrı gösterilir; ürün satışlarında çek kullanımı ayrıca belirtilir. Satış veya tam veri sıfırlama işlemleri çekleri ve bakiyelerini silmez.

Doğrulama: `npm run test:gift-vouchers` geçici veritabanlarında eski kayıtların korunmasını, yedekleme başarısızlığında işlemin durmasını, bakiye düşümünü, tekrarlı isteği, iadeleri ve fiş üretimini sınar. Gerçek mağaza veritabanına bağlanmaz.

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
