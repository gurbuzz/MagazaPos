1.0.5 — Güncelleme kurulumu, ciro, iade ve değişim düzeltmeleri.

- İadeler kendi işlem gününde cirodan düşülür; geçmiş satış gününün tahsilatı değişmez.
- Nakit/kart iadelerinde seçilen çıkış yöntemi korunur. Parçalı ödemeler, indirimler, fiyat artırımları ve ayrı ayrı iadelerde kalan kuruşlar doğru hesaplanır.
- Değişim cirodan iade gibi düşülmez; raporda değişim ve iade adetleri ayrı gösterilir. Değişimle alınan ürün iade edildiğinde toplam ödenen değer esas alınır; çek payları ilgili çeklere geri yüklenir.
- İade ekranında gösterilen bedel ile kaydedilen iade aynı hesabı kullanır. Gün sonunun son dakikasındaki satışlar rapora dahil edilir.
- Ödeme toplamıyla uyuşmayan satışlar kaydedilmez.
- Müşteri ekranının sürekli açık bağlantısı güncelleme kurulumunu engellemez. Paket doğrulama, yedekleme ve Windows kurulumu ayrı aşamalar olarak gösterilir; kurulum başlatılamazsa kasa yeniden kullanılabilir hale gelir. Güncelleme Günlüğünü Aç ile hata ayrıntılarına erişilebilir.
- Windows yönetici izin yardımcısı kurulum paketine açıkça dahil edilir ve yayımlama öncesinde doğrulanır.

İadeler için ayrı tarihli hareket tablosu eklenir. Eski veritabanı ilk açılışta bu tabloya geçirilmeden önce doğrulanmış yedek alınır. Mevcut satış ve ödeme alanları değiştirilmez; eski iadelerin bilinen tutarları korunur. Tarihi veya tutarı kesinleştirilemeyen kayıtlar raporda kontrol gerektiren kayıtlar olarak belirtilir. Geçmişte yanlışlıkla para iadesi yazılan değişim kayıtları bu güncellemeyle otomatik düzeltilmez; ayrıca incelenmelidir.

Manuel kurulum:

1. Uygulamadan güncel veritabanı yedeği alın ve açık işlemleri tamamlayın.
2. MagazaPOS'u kapatın. Bu sürümdeki MagazaPOS-Setup-1.0.5.exe dosyasını indirip mevcut kurulumun üzerine kurun. Windows yönetici izni isteyebilir. Kullanıcı verileri klasörünü silmeyin.
3. Uygulamayı açıp Ayarlar bölümünde kurulu sürümün 1.0.5 olduğunu doğrulayın.
4. Ayrıca hazırlanmış bir düzeltilmiş DB yedeği kullanılacaksa uygulama güncellendikten sonra Ayarlar → Veritabanı & Yedek bölümünden geri yükleyin. Yedekten sonra yeni satış/iade yapıldıysa eski yedeği yüklemeyin.

Uygulama içinden güncelleme için Ayarlar → Güncelleme → Güncellemeleri Kontrol Et yolunu kullanabilirsiniz. Açık satışı tamamladıktan sonra Yedekle ve Kur seçilir.
