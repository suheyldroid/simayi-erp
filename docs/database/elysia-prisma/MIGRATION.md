# Veri geçişi ve kabul koşulları

Bu paket yeni PostgreSQL şemasını tanımlar. Mevcut veriyi otomatik taşıyan tamamlanmış ETL veya canlı DB'ye uygulanmış migration değildir. Yeni DB ve eski DB ayrı tutulmalıdır; isim/kimlik değişiklikleri nedeniyle yerinde `prisma db push` uygun değildir.

## 1. Mevcut durumu sabitleme

- Kaynak commit, çalışan InvenTree sürümü, kurulu bağımlılıklar, `showmigrations` çıktısı ve PostgreSQL sürümü kaydedilir.
- Yedek ve dosya depolama manifesti alınır. Dosya alanları dosya içeriğini taşımaz; storage yollarının hedefte çözülebildiği doğrulanır.
- [runtime_dump.py](tools/runtime_dump.py) çalışan Django ortamında okunur; katalog ile gerçek tablo/kolon/constraint farkları raporlanır. Bu paket canlı DB'den introspection yapmadı.
- Satır sayıları, NULL/boş dağılımları, öksüz generic referanslar, yinelenen seri numaraları ve eklenen CHECK'lere aykırı veriler önceden çıkarılır.

## 2. Hedef şemayı oluşturma

`optimized/prisma` tüm modüllerle yüklenir. Prisma migration taslağına `optimized/constraints.sql` eklenir. PostgreSQL kurulumunda `gen_random_uuid()` kullanılabilir olmalıdır (15+ hedefinde yerleşiktir). Bu işlemler önce geçici bir geliştirme DB'sinde denenir.

Üretim için schema.sql ve Prisma migration yolları karıştırılmaz. Şema dışı CHECK/partial index'ler migration geçmişinde tutulur. `prisma migrate diff` çıktısında bu özel kısıtların yanlışlıkla kaldırılmadığı kontrol edilir.

## 3. Kimlik ve erişim dönüşümü

1. Her eski auth_user.id için yeni UUID üretin; `User.legacyUserId` alanına eski ID'yi yazın. Bu sütun benzersizdir. E-posta trim/lowercase normalizasyonunu belirleyin; aynı normalize e-postaya sahip, boş veya eksik e-postalı hesapları birleştirmeden önce tek tek çözün.
2. `username` → `legacyUsername`, first_name/last_name → firstName/lastName; görüntüleme adı → User.name. is_active/is_staff/is_superuser açıkça aktarılır. Profil, üyelik, izinler ve RuleSet kayıtları ayrıca taşınır. Eski date_joined → createdAt; son giriş zamanı gerekiyorsa ayrı arşiv olarak tutulur.
3. E-posta doğrulanmış durumunu yalnızca eski allauth EmailAddress kaydının doğrulanmış aynı e-postasıyla kanıtlayın; sadece dolu bir e-posta olduğu için emailVerified=true yapmayın.
4. Eski Django password hash'ini Better Auth credential hesabına doğrudan kopyalamayın. Varsayılan yol parola sıfırlamadır; bu akış e-posta gönderimi ile tamamlanmalıdır. Alternatif hash doğrulama/rehash köprüsü ayrı uygulama ve test ister.
5. SSO hesaplarını yalnızca provider/account kimlikleri güvenilir biçimde eşlenebiliyorsa taşıyın. Eski oturumlar, refresh/access tokenları, password reset doğrulamaları ve API tokenları geçersiz kılınır; kullanıcı yeniden giriş yapar, API anahtarları yeniden oluşturulur.
6. Bütün User FK'lerini `legacyUserId → id` eşlemesiyle dönüştürün. `NotificationMessage` içindeki genel source/target nesne ID'leri gerçek FK değildir; kullanıcıya işaret eden değerler ayrıca dönüşmelidir.
7. Owner dönüşümünde eski owner_type doğal anahtarı kullanılır: auth.user → userId UUID; auth.group → groupId. İkisinin de boş olduğu / öksüz kayıtlar hedef XOR kısıtından önce çözülmelidir.

Better Auth sign-up ile oluşturulan kullanıcıya default profil/grup kaydı yaratma işi uygulama transaction/hook'uyla tasarlanmalıdır. İş grupları Better Auth organization üyeliği olarak kendiliğinden oluşmaz.

## 4. İş verilerinin aktarımı

İş modellerinde mevcut integer PK'ler korunur. Göç aracı alan eşlemesini `FIELD-MAPPING.md` veya model-map.json üzerinden kullanmalıdır. Native UUID iş kayıtlarının değerleri değişmez.

Önerilen sıra: türler/gruplar/izinler/kullanıcılar → ayar ve lookup'lar → firma/adres/kişiler → depo/kategori/parça → üretici/tedarikçi parçası ve BOM → sipariş/üretim başlıkları → stok → satır/tahsis/sevkiyat → fiyat/test/geçmiş → ortak not/parametre/ek ve yardımcı modüller.

Bu yalnızca bir başlangıç sırasıdır; grafikte çevrimler vardır. Örneğin SelectionList.default ↔ SelectionListEntry ve Part/StockItem'ın self bağlantıları iki aşamalı yükleme gerektirebilir. Kategori defaultLocation bağlantısı için depolar önceden yüklenmelidir. Önce nullable çevrim kenarlarını NULL bırakın, kayıtlar yaratıldıktan sonra güncelleyin. Şema açık FK'leri atlayarak yükleme yapmaz. PK'si metin olan ExchangeBackend ve UUID olan makine/mesaj/thread alanları ayrı ele alınır.

- MPTT lft/rght/tree_id/level değerlerini atın; parent/variantOf kenarlarını aktarın. Döngü, kendine bağlanma ve bozuk üst düğüm denetimi yapın. pathstring alanlarını yeniden hesaplayın.
- Decimal değerleri CSV/JSON'da string olarak taşıyın. Tutar ile yanındaki currency aynı işlemde taşınmalı; finansal veriyi float'a dönüştürmeyin.
- Tarih-only alanları `YYYY-MM-DD`, timestamp alanlarını ofsetli ISO olarak taşıyın. Eski timezone varsayımlarını açıkça eşleyin.
- ModelType kayıtlarını `(appLabel, model)` doğal anahtarıyla eşleyin. Eski ContentType ID'lerinin başka kurulumlarda aynı olduğu varsayılmamalıdır. Genel integer modelId'ler iş PK'si korunduğu sürece aynı kalır.
- ApiToken.key hedefte yoktur. Kayıtlar anahtarları iptal edilmiş arşiv olarak ayrıca saklanabilir; aktif ApiKey kaydı yalnızca yeni anahtar üretilince oluşturulur.
- İsim değişen UUID PK'ler: WebhookMessage.message_id, EmailMessage.global_id, EmailThread.global_id → id. Foreign key değerleri aynı UUID olarak kalır.
- Eski ID'ler elle yüklendikten sonra tüm identity sequence'leri `MAX(id)` ile uyumlu ileri alın. Boş tablo sequence'ini 0'a ayarlamayın. Aksi halde ilk yeni kayıt PK çakışması yaratır.

## 5. Açılıştan önce kabul kontrolü

| Alan | Kabul koşulu |
|---|---|
| Kapsam | 79 kaynak iş modeli için satır/alan eşlemesi; hariç bırakılmış teknik kayıtlar açık listede |
| Kimlik | Her gerçek User FK'si UUID'ye çözülüyor; kimliksiz/çakışan e-posta kalmıyor; parola ve eski oturum stratejisi uygulanmış |
| Miktar / para | Parça-depo bazında toplam stok, açık tahsis, sipariş miktarları ve para birimi bazında tutarlar eşit |
| Seri | Aynı parçada dolu seri UNIQUE; aile/global ayarları servis testlerinden geçiyor |
| Ağaç / BOM | Döngü yok; kategori/depo/varyant alt kümeleri ve inherited BOM sonuçları eski sürümle karşılaştırıldı |
| İş akışı | Kısmi satın alma kabulü, bölünmüş sevk, iade, tüketimli/normal transfer, kısmi üretim ve test sonucu akışları karşılaştırıldı |
| Yarış koşulları | Aynı stok için eşzamanlı tahsis/sevk/tüketim fazla kullanım yaratmıyor; serial ve referans üretimi atomik |
| Yetki | Grup, RuleSet, doğrudan izin, aktif olmayan hesap ve sahiplik denemeleri eski davranışla karşılaştırıldı |
| Dosya / eklenti | Dosya yolları açılıyor; gereken rapor, etiket, makine ve JS eklenti işlevleri hazır |
| Geçiş | Yazma durdurma veya kontrollü son delta aktarımı; geri dönüş için eski DB ve dosya deposu korunuyor |

Bu kabul tablosu gelecekteki fork uygulamasına yöneliktir. Bu paketin tamamladığı kontroller [VALIDATION.md](VALIDATION.md) içinde ayrı listelenmiştir.
