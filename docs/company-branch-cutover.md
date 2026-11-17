# Şirket ve şube geçiş planı

## Amaç ve kararlar

Native Better Auth `Organization` şirketi temsil eder. Bir `Branch` yalnızca bir şirkete aittir. Native `Team` kullanıcı grubudur; şubeye veya ERP yetkisine dönüştürülmez. Mevcut şirket üyeliği ve aynı şirket üyelerinin iş kayıtlarına erişim sözleşmesi korunur.

- Malzeme tanımı, kategori ve tedarikçi şirket kapsamındadır.
- Stok bakiyesi, minimum stok, stok hareketi, satış, Excel satış dosyası ve POS cihazı şube kapsamındadır.
- Satınalma siparişi şirketten veya bir şubeden açılır. Siparişin kaynak şubesi ile her teslimatın hedef şubesi farklı bilgilerdir.
- Şirket reçetesi ortak kaynaktır. Şubede açıkça etkinleştirilir; yeni kaynak kendiliğinden satışa açılmaz.
- Şube şirket reçetesini olduğu gibi kullanabilir veya ad, açıklama, fiyat ve malzemeler dahil tam bir yerel uyarlamasını oluşturabilir. Malzeme bazlı fark birleştirme yapılmaz.
- Şubenin bağımsız yerel reçetesi de olabilir. Merkez güncellemesi özelleştirilmiş tanımı veya şubenin aktif/pasif tercihini değiştirmez.
- Şirket reçetesini global pasife almak bütün şubelerde yeni satış kullanımını durdurur; geçmiş satış anlık görüntüleri değişmez.
- Finansal kasa, para birimi ve tedarikçi borcu şirket kapsamındadır. Şubeye mal teslimatı ayrı bir finansal satınalma veya otomatik kârlılık hesabı yaratmaz.
- Merkez depo ve şirketler arası ticaret bu geçişin varsayımı değildir. Gerçekte merkez depo kullanımı teyit edilmeden hayalî merkez stoğu veya genel depo modülü eklenmez.

## Güvenli veri geçişi

Başlangıç çalışma ağacı temizdir. Migration veritabanına otomatik uygulanmaz.

Mevcut kayıtlar gerçek şirket/şube eşlemesini taşımadığı için her mevcut organizasyon şirket olarak korunur ve altında bir başlangıç şubesi oluşturulur. Eski stok, minimum stok, stok sürümü, hareket geçmişi, satışlar, dosyalar, POS ve mevcut yerel reçeteler bu şubeye atanır. Mevcut siparişlerin kaynak şubesi başlangıç şubesidir.

Native organizasyon kimliği, slug, üyeler ve takımlar değiştirilmez. Şirket birleştirmesi, aynı adlı malzeme/reçete birleştirmesi veya geçmiş stokların birden fazla şubeye kopyalanması yapılmaz. Eski teslimatların bilinmeyen fiyat, aktör veya tarih ayrıntıları uydurulmaz. UUID anlık görüntüleri, parasal değerler ve para birimleri korunur.

Yeni migration `20261202000000_company_branches` mevcut migration zincirinin sonuna eklenir. Transaction, gerekli tablo kilitleri, veri ön koşulları, aynı şirket FK'leri, tekillik ve bakiye kontrollerini içerir. Üretimde tüm eski yazarlar durdurulmadan uygulanmaz.

## Atomik işler ve bağımlılıklar

Aşağıdaki işler dosya sahipliğiyle implementer'lara bölünür. Aynı satır farklı implementer'larca değiştirilmez; API sözleşmeleri erken paylaşılır. Bağımlı işin kodlaması sözleşme üzerinden ilerleyebilir, entegrasyon kabulü ön koşulu bekler.

| İş | Tek teslimat | Bağımlılık | Kabul ölçütü |
| --- | --- | --- | --- |
| A1 | Branch, BranchStock, reçete uyarlaması/etkinliği, teslimat ve operasyon şube şeması | Yok | UUID sınırı, aynı şirket ilişkileri, stok/katalog sürüm ayrımı tanımlı. |
| A2 | Kayıpsız ileri migration | A1 | Mevcut bakiye/geçmiş tek başlangıç şubesine korunarak taşınıyor; native kimlikler değişmiyor. |
| A3 | Doğrulanmış isteğe bağlı şube bağlamı ve transaction içi yaşam döngüsü sınırı | A1 | Şirket oturumdan geliyor; yabancı şube 404; pasif şubeye operasyon yazımı yok. |
| A4 | Şube liste/detay/oluşturma/sürümlü düzenleme/pasife alma API'si | A3 | Sayfalama ve UUID; geçmiş silinmiyor; bakiye/açık iş kapanışı güvence altında. |
| B1 | Şirket item kataloğu ile şube stok/hareket API ayrımı | A1, A3 | Tam ondalık, negatif olmayan bağımsız bakiye; stok sürümü katalogdan ayrı; okuma kayıt açmıyor. |
| B2 | Şirket veya kaynak şubeli satınalma | A1, A3 | Kaynak açık; şirket tümünü, şube ilgili siparişleri görüyor; mevcut finans yaşam döngüsü korunuyor. |
| B3 | Hedef şubeli kısmi teslimat ve olay geçmişi | B1, B2 | Bir satır çok şubeye teslim alınabiliyor; olay/bakiye/sayaç aynı transaction; tekrar istek çift giriş yaratmıyor. |
| B4 | Telafi hareketli teslimat düzeltmesi | B3 | Orijinal silinmiyor; bir kez ters kayıt; stok negatife inmiyor; sipariş durum kuralları korunuyor. |
| C1 | Şirket/yerel reçete, etkinleştirme, tam özelleştirme ve ortak tanıma dönüş | A1, A3 | Bağımsız etkinlik ve içerik; kaynak/yerel sürüm çakışması reddediliyor. |
| C2 | Şubeye göre çözülen iç içe reçete grafiği | C1 | Alt tanımlar aynı şubeden; döngü, yabancı şube ve kullanılamayan alt reçete reddediliyor. |
| C3 | Şube satışı ve değişmez etkili reçete/fiyat anlık görüntüsü | B1, C2 | Yalnız hedef şube stoğu tüketiliyor; eski satış değişmiyor. |
| C4 | Excel eşleme/önizleme/işleme ve tahsilat kapsamı | C3 | Dosyanın şubesi sabit; önizleme/işleme aynı etkili reçete ve şube bakiyesini kullanıyor. |
| D1 | Şube POS ve aynı şubeli Z raporu/dosya bağlantısı | A3, C4 | Cihaz şubesi sabit; başka şubenin dosyası bağlanamıyor. |
| D2 | Finans kaynak kimliği ve tek şirket defteri | B2, C3 | Bir sipariş tek finans yaşam döngüsü; ters kayıt kaynak satışı izliyor. |
| D3 | Şube stoklu pano SQL/toplulaştırmaları | A1, B1 | Eski `part.stock` sorgusu yok; canlı üyelik filtresi ve katalog sayım anlamı korunuyor. |
| E1 | URL ile doğrulanan şirket/şube frontend bağlamı | A4 | Şirket modu açık; seçili şube doğrulanmadan alt iş verisi mount edilmiyor. |
| E2 | Ayrı istemci/önbellek ve güvenli kapsam geçişi | E1 | Global/şirket sorguları şubeye bağımlı değil; eski şube formu veya verisi yeni şubeye taşınmıyor. |
| E3 | Şube index/show, Sheet'ler ve seçim/gezinme | E1, E2 | Gerçek API, sayfalama, Actions/Details, onaylı pasife alma, tek kabuk. |
| E4 | Resmî TanStack rota üretimi | E3 | Üretilmiş ağaç elle düzenlenmiyor. |
| F1 | Item/stok ekranlarının ayrılması | B1, E2 | Katalog şubesiz çalışıyor; stok/minimum/sürüm seçili şubeye ait. |
| F2 | Şirket/şube satınalma ekranları | B2, E2 | Kaynak görünür; mevcut satır/finans/durum işlemleri korunuyor. |
| F3 | Teslimat hedefi, geçmişi ve onaylı düzeltme ekranları | B3, B4, F2 | Hedef şubenin stoğu geçersiz kılınıyor; kaynak şube ile karıştırılmıyor. |
| G1 | Ortak/yerel/özelleştirilmiş reçete yönetimi | C1, C2, E2 | Etkinlik, kaynak, sürüm ve dönüş işlemleri gerçek uçlara bağlı. |
| G2 | Şube satış ekranları | C3, G1 | Etkili aktif reçete seçimi ve şubeli liste/detay/eksik stok. |
| G3 | Şube Excel satış ekranları | C4, G2 | Yükleme/eşleme/önizleme/işleme kapsamı aynı ve sabit. |
| H1 | POS/Z raporu ekranları | D1, E2 | Şube kapsamı ve dosya seçimi tutarlı. |
| H2 | Şirket finansı ve kaynak şubeye giden bağlantılar | D2, E2 | Şirket toplamları korunuyor; geçmiş satış bağlantısı doğru şubeye gidiyor. |
| H3 | Pano kapsamı, uyarılar ve veri önbelleği | D3, E2 | Düzen kullanıcı+şirket için korunuyor; veri seçili şubeyle süzülebiliyor. |

## Merkezi kabul ve doğrulama

İş sahipleri kendi değişikliklerini özetler; supervisor gerçek diff'i ve ilgili uygulamaları bağımsız inceler. Engelleyici hatalar aynı iş sahibine en fazla iki düzeltme turuyla döner. Özet tek başına kabul kanıtı değildir.

Proje politikası gereği test dosyası, test komutu veya test altyapısı eklenmez; birim, entegrasyon, E2E, smoke, tarayıcı ve manuel test çalıştırılmaz. İşler sürerken build/lint/formatter çalıştırılmaz. Prisma üretimi şema bağımlılığı için, rota üretimi resmî TanStack aracıyla yapılır. Entegrasyon tamamlandığında API typecheck/lint ve web build/lint gibi izin verilen statik kontroller merkezi yürütülür.

Kabul sınırı: Statik kontroller canlı veri aktarımını veya çalışma zamanı davranışını kanıtlamaz. Migration'ın hazırlanmış olması uygulanmış olduğu anlamına gelmez; dağıtım durumu son teslimde ayrıca belirtilir.

## Uygulama durumu

A1–H3 kapsamındaki 28 atomik işin uygulaması tamamlandı. İşler sekiz implementer sahiplik dilimine ayrıldı; gerçek diff'ler, SQL ve kritik kapsam/eşzamanlılık yolları supervisor ve bağımsız reviewer'lar tarafından incelendi. Aşağıdaki statik kabul kayıtları tamamlandı; bu kabul, migration'ın uygulandığı veya çalışma zamanı davranışının test edildiği anlamına gelmez.

### A1-A4 çekirdek teslimatı (şema, migration, branch bağlamı, branch API)

- Şema (`apps/api/prisma/schema.prisma`): `Branch`, `BranchStock`, `BranchRecipe`, `PurchaseReceipt`; `Recipe` üzerinde `branchId`/`sourceRecipeId`/`sourceVersion`; `ItemTracking`, `Build`, `SalesBatch`, `SalesProductMapping`, `PosDevice` için zorunlu `branchId`; `PurchaseOrder` için kaynak `branchId`; `Part.stock` ve `Part.minimumStock` kaldırıldı. Tüm şube ilişkileri aynı şirket bileşik FK'leridir. Prisma Client ve Prismabox resmî `db:generate` ile üretildi; üretilen dosyalar elle düzenlenmedi.
- Şube bağlamı (`lib/tenant.ts`, `modules/auth/plugin.ts`): `TenantActor` artık `branchId`/`branchUuid` taşır; `BranchActor` daraltılmış tiptir. İsteğe bağlı `X-Branch-Id` doğrulanır: bozuk UUID 422, başka şirkete ait/bilinmeyen UUID 404, eksik başlık şirket bağlamıdır (örtük varsayılan şube yoktur). Pasif şube okuma/geçmiş için çözümlenir. CORS ve OpenAPI açıklaması başlığı içerir.
- Yetkili yardımcı (`modules/branches/service.ts`): `BranchesService.requireActor(db, actor, { active, lock })`, `requireByUuid(db, organizationId, branchUuid, { active, lock })` ve `lock(db, branchId, mode)`. `active: true` pasif şubeyi 409 `BRANCH_INACTIVE` ile reddeder; kilit varsayılanı `active: true` iken `shared`, aksi halde `none` olup şube yeniden okunmadan önce alınır.
- Yazım yollarındaki kilit sonrası etkinlik okuması `SELECT ... FOR SHARE` kullanır: eski Serializable snapshot ile pasife alınmış şubeye yazma yarışı kapanır. PostgreSQL `40001`/`40P01` ham Prisma sorgularında `P2010` olarak gelebileceği için yalnız bu iki SQLSTATE, mevcut `P2034` ile birlikte 409 `CONCURRENT_UPDATE` olarak eşlenir; diğer ham sorgu hataları gizlenmez.
- Kilit sırası: şube yaşam döngüsü iki anahtarlı advisory kilit `(814209, branchId)` → sipariş 814206 → kategori 814202 → malzeme 814203 → reçete 814204 → stok 814205 → finans 814207. Şube yazımları `shared`, pasife alma/aktifleştirme `exclusive` alır; kapanış başka advisory kilit almaz.
- Branch API: `GET /branches/` (limit/offset/search/active), `POST /branches/`, `GET/PATCH /branches/:branchUuid` (zorunlu `version`, UUID, sayfalama). Silme ucu yoktur. `active: false` yalnızca tüm bakiyeler sıfır, kaynak şubeli açık sipariş (10/20/25), taslak satış dosyası (10) ve etkin POS cihazı yokken geçer; aksi halde 409 `BRANCH_IN_USE` ayrıntı sayaçlarıyla döner. Yeni şube stok satırı veya reçete etkinliği oluşturmaz.
- Migration (`apps/api/prisma/migrations/20261202000000_company_branches/migration.sql`): tek `BEGIN/COMMIT`, tablo kilitleri, veri ön koşulları; her organizasyon için tek başlangıç şubesi; bakiye/minimum/sürüm kopyası (bakiye veya minimum sıfırdan farklıysa **ya da mevcut sürüm sıfırdan farklıysa** satır korunur); hareket/satış/dosya/eşleme/POS/sipariş ve mevcut reçetelerin şubeye atanması; teslim alınmış satır başına açıkça `legacyBaseline` olarak işaretli teslimat kaydı; aynı şirket FK'leri, benzersizlikler, bakiye/teslimat kontrolleri ve reçete kaynak, sipariş kaynak, satış/dosya/cihaz/Z raporu, teslimat ters kayıt bütünlüğü trigger'ları. `Part.stock`/`minimumStock` yalnızca kopyadan sonra düşürülür.
- Migration yerel `localhost:5432` üzerindeki `simayi-erp` / `public` veritabanına kullanıcı isteğiyle uygulandı. Diğer ortamların durumu bu kayıttan çıkarılmaz. Dağıtımda API/web süreçleri durduruldu, veritabanı ve `MEDIA_ROOT` yedeği alındı, `bun run db:deploy` çalıştırıldı ve yeni süreçler yeniden başlatıldı. Otomatik şirket birleştirme veya veri onarımı yapılmadı; geçmiş teslimatların bilinmeyen stok miktarı/fiyat/aktör/zaman alanları NULL kalır ve bu satırlar ters kaydedilemez.

### G1-G3 reçete, satış ve Excel satış arayüzleri

- Kapsam: `apps/web/src/features/recipes/**` ve `apps/web/src/features/sales/**` (batch'ler dahil). Şube bağlamı kanonik yol segmentidir: `/o/$organizationSlug/b/$branchUuid`; şirket bağlamı `/o/$organizationSlug`dur ve şube seçimi arama parametresinde taşınmaz. Şube segmenti şirkete ait olduğu doğrulanmış UUID'yi taşır. Şube yolu yoksa reçete dizini şirket şablonlarını ve tüm şubelerin yerel reçetelerini şube sahipliğiyle gösterir; şirket şablonu oluşturma/düzenleme şirket yolunda kalır ve şablon içi reçete seçici `templates=true` ile yalnız şirket şablonlarını listeler. Şube yolunda o şubenin etkili kataloğu yönetilir.
- Reçete API'si (gerçek uçlar): `GET/POST /recipes/`, `GET/PATCH/DELETE /recipes/:uuid` her iki bağlamda; şube bağlamında `PUT /recipes/:uuid/activation`, `POST /recipes/:uuid/customize`, `POST /recipes/:uuid/reset`. Şube çağrıları `branchApi` ve yakalanan `branchUuid` ile `X-Branch-Id` gönderir; şirket çağrıları `api` üzerinden gider ve başlık taşımaz.
- Etkili reçete DTO'su `scope` (`company`/`local`/`customized`), etkili `active`, içerik `version`, `sourceRecipeUuid`/`sourceVersion`, şirket kapısı `sourceRecipeActive`, `customizationUuid`, `activation { active, version }` ve şirket şablonunda `null` olan `branch { uuid, name }` alanlarını taşır. Şube seçicisinde kimlik şirket kök UUID'si (company/customized) veya yerel UUID'dir (local); özelleştirme satırı UUID'si seçici olarak kullanılmaz.
- Reçete ekranları: index'te etkinlik yalnızca gösterilir, mutasyon `Details` sayfasındadır. Şube modunda etkinleştirme/pasifleştirme `activation.version` (ilk yazım 0), tam özelleştirme `version`'ı kaynak sürüm olarak sabitler, şirkete dönüş onaylıdır ve yerel etkinliği korur. Özelleştirilmiş tanımın düzenlenmesi ve şirkete dönüş, açılışta yakalanan `customizationUuid` ile birlikte `version` gönderir; böylece bayat bir form yeni oluşturulmuş bir kopyayı ezemez veya silemez. Şirket şablonu global pasifse hiçbir şubede etkinleştirilemez/satılamaz ve şube ekranı bunu açıkça gösterir. Şirket modunda oluşturma/düzenleme/silme ortak şablonu yönetir; yerel reçete yalnızca şube modunda oluşturulur ve silinir.
- Reçete seçici (`features/recipes/components/recipe-select.tsx`) POS/batch/satış tüketicileri için ortak yüzeydir: `GET /recipes/?active=true` çağrısını şube başlığıyla yapar, yalnız etkili etkin reçeteleri listeler; şirket şablonu düzenleyicisinde `templates=true` ile yalnız şirket şablonlarını listeler, böylece şube yerel reçetesi şirket şablonuna malzeme olarak eklenemez. Sorgu anahtarları `[root, branchCacheScope(uuid), …]` önekiyle başlar ve yakalanan `branchUuid`'i ayrı bir öğe olarak taşır: seçici `['recipe', scope, 'select', 'active', page, search, branchUuid]`, liste `['recipe', scope, 'list', …]`, detay `['recipe', scope, 'detail', uuid, …]`. Şirket şablonu değişikliği aynı şirketin tüm şube kapsamlarını; şube mutasyonu ise yakalanan şube kapsamını ve aynı şirketin tüm-şubeler toplamını (`<organizasyon>::company`, yakalanan organizasyon kapsamından türetilir) geçersiz kılar.
- Satış dizini şube yolunda yalnız o şubenin satışlarını, şirket yolunda tüm şubelerin satışlarını kaynak şubesiyle listeler; satış kaydı yalnız aktif şube yolunda açılır. Pasif şube geçmişi okunur, yazımlar kapalıdır (`BranchInactiveNotice`). `GET /sales/` ve `GET /sales/:uuid` şirket yolunda şube başlığı olmadan şirket `api` istemcisiyle geçerli okumalardır (tüm şubeler veya şube sahipliğiyle); şube yolunda şube başlığıyla o şubeye daralır. `POST /sales/` ve `POST /sales/:uuid/receipts` yalnız doğrulanmış aktif şube yolunda `branchApi` ile çağrılır. Liste/detay anahtarları kapsamı (şube veya şirket) taşır. Satış kaydı etkili reçete UUID'sini gönderir, eksik stok mesajı şube bakiyesini gösterir ve anlık görüntü/fiyat/ürün alanları değişmeden gösterilir. Detay, `branch` özeti ile donmuş `recipeDefinitionUuid`/`recipeSourceVersion` kanıtını gösterir; tahsilat ve ters kayıt işlevleri korunur.
- Excel satış dosyaları şubeye sabittir: yükleme ve işleme yalnız aktif şube yolunda `X-Branch-Id` ile yapılır; şube listesi o şubenin partilerini, şirket dizini tüm şubelerin partilerini şube sahipliğiyle listeler. Parti detayı ve orijinal çalışma kitabı indirme (`GET /sales/batches/:uuid` ve `/file`) şirket yolunda şube başlığı olmadan şirket `api` istemcisiyle geçerli okumalardır; şube yolunda farklı şubeye ait parti 404 olur. Önizleme, yapılandırma, işleme ve silme ise partinin sahibi olan şubenin aktif yoluyla sınırlıdır; başka şubenin dosyası 404 ile kapalıdır. Eşlemede ürün seçimi o şubenin etkili reçetelerinden gelir; kanal tanımları ve kanal eşlemeleri şirket ortaklığında kalır. Önizleme malzeme ihtiyacı batch şubesinin bakiyesini gösterir; işleme sonrası satış ve şube stok önbellekleri aynı yakalanan kapsamda geçersiz kılınır.
- Şube değişiminde şube istekleri iptal edilir; stok/satınalma/satış/POS ve reçete iş yüzeyleri şube yolu değişimiyle yeniden mount edilerek eski formun yeni şubeye taşınması engellenir. `branchOutletKey` yalnız aynı rota eşleşmesi içinde remount ipucudur; şirket ve şube yolları ayrı rota eşleşmeleridir ve şube A→B yol parametresini değiştirdiğinden React anahtarı bileşen yerel durumunu garanti etmez. Kaydedilmemiş kişisel pano taslağı sessizce atılmaz: pano taslağı kirliyken (kayıtlı düzenden farklı) veya kart editörü açıkken pano dışına her router gezinmesi (şube/şirket anahtar değişimi dahil) mevcut `dashboard:builder.discardTitle`/`discardDesc` onayıyla durdurulur; `İptal` taslağı korur, açık `At` geçişe izin verir, autosave yoktur ve yeni kalıcı taslak deposu eklenmez. Şube bağlantısı ön yüklemesi (`preload`) şube okuması, tenant doğrulaması, etkin şube yayını veya istek iptali yapmaz; gerçek gezinme mount öncesi doğrular ve yayın router engelleri geçtikten sonra olur, bu yüzden iptal edilen onay diyaloğu etkin şubeyi ve uçuştaki istekleri değiştirmez. Mutasyon sonuçları yakalanan şube kapsamının önbelleğini ve aynı şirketin tüm-şubeler toplamını (`<organizasyon>::company`, yakalanan organizasyon kapsamından türetilir) yeniler, fakat kullanıcı başka kapsama geçtiyse yeni ekranı kapatmaz veya eski kayda yönlendirmez. Tipli bağlantılarda şube yolu korunur; şirket kapsamına dönüş, şube segmenti olmayan şirket yoluna gitmekle yapılır, arama parametresiyle değil.

### Merkezi statik kabul sonuçları

| Kontrol | Gözlenen sonuç |
| --- | --- |
| `apps/api`: `bun run check-types` | Başarılı, TypeScript hatası yok. |
| `apps/api`: `bun run lint` | Başarılı; ESLint ve Prettier kontrolü geçti. |
| `apps/web`: `bun run build` | Başarılı; TypeScript ve Vite production build tamamlandı. |
| `apps/web`: `bun run lint` | Başarılı; 0 hata, değiştirilmemiş TanStack Table yüzeyinde 1 `react-hooks/incompatible-library` uyarısı. |
| Değişen web kaynak dosyalarında hedefli Prettier kontrolü | Başarılı. |

Vite build çıktısında `configLoader: native` için mevcut `__dirname` kullanımı ve 500 kB üzerindeki bundle parçası uyarıları vardır. Bu görevde uyarı bastırma, Vite yapılandırması değişikliği veya bundle optimizasyonu yapılmadı.

Kaynak incelemesinde bulunan teslimat tekrar-istek kimliği, UUID kanonikleştirmesi, ters kayıt projeksiyonu, şube yaşam döngüsü snapshot yarışı, reçete özelleştirmesi silinip yeniden oluşturulunca eski formun yazması ve seçici/liste sayfa boyutu önbellek çakışması düzeltildi. Bu bulgular test çalıştırıldığı anlamına gelmez.

### Dağıtım ve kabul sınırı

- Hiçbir test yazılmadı veya çalıştırılmadı; tarayıcı, smoke ve manuel özellik testi yapılmadı. Yerel dağıtım yalnız migration komutları, Prisma kayıtları ve süreç başlangıç loglarıyla doğrulandı; iş akışları test edilmedi.
- `20261201000000_recipe_nested_ingredients` ve `20261202000000_company_branches` yerel `simayi-erp` / `public` veritabanına uygulandı. Prisma 50 tamamlanmış migration, 0 çözülmemiş başarısızlık ve `Database schema is up to date!` sonucu verdi. Diğer ortamların migration durumu ayrıca doğrulanmalıdır; yeni API eski şemayla çalıştırılmamalıdır.
- Eski organizasyonları hangi gerçek şirket altında birleştirmek gerektiği veriyle tanımlı değildir; otomatik şirket/şube birleştirmesi yapılmaz. Her mevcut organizasyon kendi şirketini ve tek başlangıç şubesini korur.
- Eski toplam teslimat satırları ayrıntıları bilinmeyen `legacyBaseline` kayıtlarıdır; otomatik ters teslimat yapılamaz. Tamamlanmış/iptal edilmiş siparişler fiziksel düzeltmeyle yeniden açılmaz; muhasebesel iade bu kapsamda değildir.
- Commit veya push yapılmadı.

### Son yerel dağıtım kaydı

- Hedef: `localhost:5432`, veritabanı `simayi-erp`, şema `public`.
- Veritabanı custom-format yedeği, medya arşivi, SHA-256 değerleri ve uygulama kaydı: `/Users/suheyl/.local/share/mel-logistics/backups/2026-11-16T04-51-56-820Z-company-branches/` (`database.dump`, `media.tar.gz`, `deployment.json`). Yedek dizini yalnız kullanıcı erişimine açık `0700`, yedek ve kayıt dosyaları `0600` izinleriyle oluşturuldu.
- API `127.0.0.1:3000`, Vite `localhost:5173` başlangıç logları gözlendi; `mel-logistics-dev-after-migration` geliştirme servisi kalıcı olarak yeniden başlatıldı. HTTP veya tarayıcı isteğiyle özellik testi yapılmadı.

