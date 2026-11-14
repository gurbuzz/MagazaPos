# Windows güncelleme süreci

## Hediye çeki sürümüne geçiş ve kullanım

`MagazaPosKurulum.bat` artık `db push --accept-data-loss` veya örnek veri yükleme çalıştırmaz. Her seferinde aynı betikle paketleme yapabilirsiniz; mevcut kullanıcı verileri dizinini, mağaza veritabanını ve lisans dosyalarını silmeyin. İlk kurulumda uygulama mevcut şablondan veritabanı oluşturur; sonraki açılışlarda kalıcı mağaza veritabanını kullanır. `prisma/seed.ts` dolu bir veritabanına örnek veri yüklemeyi reddeder.

Hediye çeki tabloları ilk açılışta eklenir. Önce SQLite bütünlüğü denetlenir, tutarlı bir yedek alınır ve ayrı bağlantıyla doğrulanır. Yedek alınamazsa işlem yapılmaz ve API satış kabul etmez. `GiftVoucher` ve `GiftVoucherMovement` tabloları tek işlemde eklenir; mevcut satış, ürün, stok ve müşteri tabloları bu geçişte yeniden oluşturulmaz veya temizlenmez. Geçiş yedeği kullanıcı verileri dizinindeki `backups/hediye_oncesi_*.db` konumundadır ve rutin yedek temizliği bu dosyaları silmez.

Mağazada ilk uygulamadan önce Ayarlar → Veritabanı & Yedek bölümünden yedek indirip başka bir cihazda saklayın. Mağaza verisinin bir kopyasında yükseltmeyi doğrulayın; testler örnek kayıtlarla yapılır, Windows cihazındaki gerçek verilerin testi yerine geçmez. İlk açılışta eski kayıtları, stokları ve satışları kontrol edin. Eski yedeğe dönmek, o yedekten sonra oluşturulan çek ve satışları da geri alır; işlem yapmaya başladıktan sonra eski yedeği doğrudan yüklemeyin.

Navbar’daki hediye simgesiyle **Çek Oluştur** veya **Sorgula / Tekrar Yazdır** açılır. Nakit/kart karşılığı çekler ve yönetici PIN’iyle mağaza hediyeleri desteklenir. Kart seçimi banka terminalinden tahsilat yapmaz; önce tahsilatı tamamlayın. Oluşturma işlemi tekrar denendiğinde aynı işlem kimliği aynı çeki getirir. Yazıcı hatasında yeni çek oluşturmak yerine tekrar yazdırın. Bu sürümde çekler süresizdir ve nakit para üstü verilmez.

Ödeme ekranında **Hediye Çeki Kullan** alanına barkodu okutun, sorgulayın ve kullanılacak tutarı belirleyin. Kalan tutar nakit, kart veya parçalı ödeme ile tamamlanır. Çek bakiyesi satış ve stok hareketleriyle aynı veritabanı işleminde düşer. Kopya fiş ek bakiye oluşturmaz. İadelerde çekle ödenen pay çeke, nakit/kart payı başlangıç oranlarına göre geri döner. Ücretli çek oluşturma tahsilatları Net Kasa Cirosu ve ödeme yöntemine göre Net Nakit Kasa / Net Kart Tahsilat toplamlarına dahildir. Ürün alışverişinde çek tutarı tekrar sayılmaz; yalnızca ek nakit/kart tahsilatı eklenir. Rapor çek oluşturma payını ayrıca gösterir. Mağaza hediyeleri tahsilat oluşturmaz. Satış veya tam veri sıfırlama işlemleri çekleri ve bakiyelerini silmez.

Doğrulama: `npm run test:gift-vouchers` geçici veritabanlarında eski kayıtların korunmasını, yedekleme başarısızlığında işlemin durmasını, bakiye düşümünü, tekrarlı isteği, iadeleri ve fiş üretimini sınar. Gerçek mağaza veritabanına bağlanmaz.

## Hediye çeklerinin kasa cirosuna etkisi

Kasa cirosu, ücretli çek oluşturma tahsilatları + ürün satışındaki nakit/kart ödemeleri − nakit/kart iadeleri olarak hesaplanır. Çek bakiyesinden ödeme ve çeke geri yüklenen iade bu toplama tekrar eklenmez veya toplamdan düşülmez. Örneğin 1.000 TL nakit çek oluşturma kasaya 1.000 TL ekler; çekle 650 TL alışveriş ek tahsilat oluşturmaz. Sonraki 500 TL alışverişin 350 TL'si çekten, 150 TL'si karttan ödendiğinde ciroya yalnızca 150 TL daha eklenir.

Bu hesap geçmiş çek kayıtları için de geçerlidir; veritabanı şeması veya kayıt içerikleri değiştirilmez. Fişlerdeki ürün tutarları korunur; satış inceleme ekranındaki NET KASA GELİRİ yalnızca o satışın ek nakit/kart tahsilatını gösterir. Çek oluşturmak ürün veya satılan adet sayısını artırmaz.

Tarih aralığı çekin oluşturulma tarihine uygulanır; önceki gün oluşturulmuş çekin bugün kullanılması bugüne çek bedeli kadar tahsilat eklemez. Nakit/kart filtreleri parçalı ödemedeki ilgili payı kapsar. Arama eşleşmesi olmayan çekler rapor toplamına eklenmez. Son 20 fiş görüntülense bile toplamlar filtreye uyan bütün kayıtlardan hesaplanır. Çek penceresindeki genel toplamlar ise açıkça tüm zamanları gösterir.

İadeler mevcut raporlama düzeninde orijinal satışın tarih aralığına yansır. Bu rapor ayrı bir günlük kasa hareket defteri veya açılış bakiyesi kaydı tutmaz; farklı gün yapılan nakit/kart iadesini iade gününde göstermek ayrı bir hareket kaydı gerektirir.

## Açılışta `Cannot find module 'electron-updater'` hatası

Bu hata, kurulu uygulamanın güncelleme modülünü içermediğini gösterir. Aynı modül kaynak klasöründeki `node_modules` içinde de eksikse TypeScript `TS2307` ve güncelleme olaylarında `TS7006` hataları verir.

Windows'ta güncel kaynak koduyla `Paketle_EXE.bat` dosyasını çalıştırın. Betik, her paketlemeden önce `npm ci --include=dev` ile kilit dosyasındaki bağımlılıkları kurar. Alternatif olarak kaynak klasöründe sırasıyla `npm ci --include=dev` ve `npm run package:win` çalıştırın. `release` klasöründe yeni oluşturulan kurulum dosyasını mevcut uygulamanın üzerine kurun. Kaynak klasöründe paketleri kurmak, daha önce oluşturulmuş EXE'yi düzeltmez. Mevcut mağaza veritabanını veya kullanıcı verileri klasörünü silmeyin.

`MagazaPosKurulum.bat` da bağımlılıkları aynı şekilde kurar ve TypeScript hatası varsa paketlemeyi durdurur.

## Yeni sürüm yayınlama

### GitHub Actions ile otomatik yayın

Sürüm numarası `package.json` ve `package-lock.json` içinde yükseltilip değişiklikler gönderildikten sonra aynı numaralı etiket gönderilir (örneğin `git tag v1.0.1` ve `git push origin v1.0.1`). `Windows Release` iş akışı önce izole veritabanında hediye çeki ve güncelleme testlerini çalıştırır. Ardından Windows ortamında sıfırdan, yalnızca şema içeren boş kurulum veritabanı oluşturur; mağaza kayıtlarını paketlemez. EXE, blockmap, manifest özeti ve paket içindeki güncelleme/Prisma bağımlılıkları doğrulandıktan sonra GitHub Release yayımlanır. Herhangi bir adım başarısız olursa yeni Release yayımlanmaz. GitHub Actions için depoda izinlerin açık olması gerekir; yayın için iş akışının kendi `GITHUB_TOKEN` anahtarı kullanılır.

### Windows bilgisayarda elle yayın

Etiket gönderildiğinde otomatik çalışma oluşmazsa GitHub'da Actions → Windows Release → Run workflow üzerinden mevcut sürüm etiketi girilerek yayın başlatılabilir. Etiketin gösterdiği kod kullanılır; sürüm numarası etiketle eşleşmezse paketleme durur.

Güncelleme kaynağı `gurbuzz/MagazaPos` GitHub deposunun yayınlanmış Release kayıtlarıdır. Kaynak kodunu göndermek tek başına güncelleme yayınlamaz.

Ayarlar → Güncelleme ekranındaki **Kurulu sürüm**, POS'ta çalışan EXE'nin sürümüdür. Henüz yayımlanmış Release yoksa bu durum ayrı bir mesajla gösterilir; bağlantı veya eksik `latest.yml` hataları da güncel sürüm olarak değerlendirilmez. Daha yeni paket bulunamadığı mesajı, yalnızca yayımlanmış paketle karşılaştırmayı ifade eder; GitHub'daki son kaynak kodunun POS'ta bulunduğu anlamına gelmez. Ayarlar kapatılıp açıldığında devam eden indirme veya kuruluma hazır paket durumu korunur.

Örneğin kurulu EXE `1.0.0` ise yeni paket `1.0.1` veya daha yüksek olmalıdır. Aynı `1.0.0` numarasıyla tekrar paketlemek güncelleme oluşturmaz. Sürümü artırırken `package.json` ve `package-lock.json` birlikte güncellenmelidir (`npm version 1.0.1 --no-git-tag-version`).

1. Paket ve veritabanı şablonunun paylaşılabilir olduğundan ve Git geçmişinde gizli bilgi bulunmadığından emin olun. Depoyu herkese açık yapmak bütün kodu ve geçmişi de açar; tekrar gizlemek daha önce indirilen kopyaları geri almaz.
2. `package.json` sürümünü mevcut kurulu sürümden yüksek bir sürüme yükseltin. Sürüm numaralarını tekrar kullanmayın.
3. Windows'ta `npm ci` ve `npm run package:win` çalıştırın. Kurulum dosyasını, `latest.yml` dosyasını ve oluşan `.blockmap` dosyasını aynı GitHub Release'e yükleyin. Release'i taslak veya ön sürüm olarak bırakmayın.
4. Depo herkese açıkken POS'ta Ayarlar → Güncelleme → Güncellemeleri Kontrol Et → Güncellemeyi İndir adımlarını uygulayın. İndirme tamamlanana kadar depo açık kalmalıdır.
5. Açık satışı tamamlayın veya sepeti temizleyin, ardından Yedekle ve Kur'u seçin. Kurulum sırasında Windows yönetici izni isteyebilir.
6. Güncelleme tamamlanınca uygulamanın açıldığını, satışları, stokları ve müşteri kayıtlarını kontrol edin. Ardından depoyu tekrar özel yapabilirsiniz.

İlk kez bu özelliği içeren sürümün normal kurulumla POS'a yüklenmesi gerekir. Güncelleme öncesi yedek kullanıcı verileri dizinindeki `backups` klasörüne alınır. Yedek doğrulanamazsa kurulum başlamaz. Yedekleme cihaz arızasına karşı bağımsız bir yedek yerine geçmez.

Şema değişiklikleri için henüz sürümlü veritabanı geçiş ve otomatik geri alma sistemi yoktur. Veritabanını değiştiren bir sürümü yayınlamadan önce mağaza verisinin kopyası üzerinde geçişi ve yedekten kurtarmayı test edin; gerekirse geçiş mekanizmasını ayrıca geliştirin. Eski uygulama sürümünü yeni şemaya karşı çalıştırmanın güvenli olduğunu varsaymayın.
