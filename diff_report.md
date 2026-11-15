# InvenTree referansına göre ERP fark raporu

Tarih: 1 Kasım 2026.

Bu rapor, currency ve fason üretimin kaldırılması, e-postasız kullanıcı adıyla kimlik doğrulamaya geçilmesi **öncesindeki** kaynak kodu incelemesini kaydeder. Bir geliştirme taahhüdü veya bu ERP'nin zorunlu kapsam listesi değildir. Proje InvenTree'den esinlenmiştir; referanstaki her özelliğin uygulanması gerekmemektedir.

İnceleme kaynak kod üzerinden yapıldı; uygulama, veritabanı veya test çalıştırılmadı. “Var” ifadesi kodda uygulama bulunduğunu gösterir, çalışma zamanı doğruluğu garantisi değildir.

## 1. Referans kapsamı

- `docs/docs/`: InvenTree'nin ürün yetenekleri.
- `docs/database/elysia-prisma/`: Elysia/Prisma'ya taşımaya yönelik geniş hedef şema ve tasarım.

| Ölçüm | Model sayısı |
| --- | ---: |
| Referans `optimized/prisma` şeması | 93 |
| Uygulamadaki Prisma şeması | 44 |
| Referansta bulunup uygulama şemasında aynı adla bulunmayan | 49 |

Bu sayılar tamamlanma yüzdesi değildir. Modelin bulunması iş akışının tamamlandığını göstermez. Ayrıca Prisma modeli bulunmaması SQL migration bulunmadığı anlamına gelmez; aşağıdaki migration düzeltmesi bu ayrımı açıklar.

Kaynaklar: [hedef şema](docs/database/elysia-prisma/README.md), [uygulama şeması](apps/api/prisma/schema.prisma).

## 2. Mevcut iş akışlarındaki somut farklar

### BOM pieceCount

Referans ihtiyaç hesabı `miktar × parça adedi × üretim adedi` şeklindedir. `pieceCount` BOM kaydında saklanır; ancak `BuildBomSync.required` yalnızca `quantity × buildQuantity` üzerinden ilerler, ardından fire, hazırlık miktarı ve yuvarlama uygular. `pieceCount` kullanılmaz.

[INFERENCE — çalıştırılmadı]: 200 mm uzunluğunda 10 parçadan oluşan ürünün 5 adet üretimi için diğer katsayılar sıfırken beklenen ihtiyaç 10.000 mm, mevcut hesap 1.000 mm olur.

Kaynaklar: [BOM referansı](docs/docs/manufacturing/bom.md), `apps/api/src/modules/build/builds/bom-sync.ts`, `apps/api/src/modules/build/builds/service.ts`.

### BOM birimli/kesirli miktar

Referans `500 g`, `1/2 kg`, `2 cm` ifadelerinin parça birimine çevrilmesini tarif eder. Mevcut `rawAmount` düz decimal string doğrulamasına girer; miktar yorumlama ve birim dönüşümü davranışı yoktur.

Kaynaklar: [BOM referansı](docs/docs/manufacturing/bom.md), `apps/api/src/modules/part/bom/service.ts`.

### Fason üretim

`Build.external` şemada vardır; oluşturma sırasında sabit `false` yazılır. Satınalma satırında fason üretim emrine bağlanacak ilişki yoktur. Fason üretim → satınalma → teslim alma → üretim çıktısı zinciri uygulanmamıştır.

Kaynaklar: [fason üretim](docs/docs/manufacturing/external.md), `apps/api/src/modules/build/builds/service.ts`, `apps/api/prisma/schema.prisma`.

### Kalıcı kayıt yapmayan ayar ekranları

`/settings` altındaki profil, hesap, bildirim ve görüntüleme formları gönderimde `showSubmittedData` ile veriyi toast içinde gösterir. `/common/settings` ise gerçek backend okuma/yazma uçlarına sahiptir. Bütün ayar sistemi eksik değildir; eski ekranların gerçek servislerle bağlantısı eksiktir.

Kaynaklar: `apps/web/src/features/settings/`, `apps/web/src/lib/show-submitted-data.tsx`, `apps/api/src/modules/common/settings/controller.ts`.

## 3. Eksik uygulama yetenekleri

| Alan | Referansa göre eksik kapsam | Referans |
| --- | --- | --- |
| Satış ve sevkiyat | Satış siparişi, satırlar, stok tahsisi, sevkiyat kayıtları ve bölünmüş sevkiyat | [Satış](docs/docs/sales/sales_order.md) |
| İade / RMA | Müşteriden stok geri alma, iade satırları ve sonuç takibi | [İade](docs/docs/sales/return_order.md) |
| Transfer emirleri | Kaynak/hedef, satırlar, tahsis ve tamamlanmayla izlenen transfer belgesi; tekil stok taşıma bundan farklıdır | [Transfer](docs/docs/stock/transfer_order.md) |
| Genel dosya ekleri | İş kaydına dosya/link ekleme, indirme ve thumbnail yaşam döngüsü; SQL hazırlığı vardır, uygulama entegrasyonu eksiktir | [Ekler](docs/docs/concepts/attachments.md) |
| Ortak notlar ve etiketler | Çoklu zengin metin notu, birincil not, görseller, paylaşılan tag ve filtreleme; SQL hazırlığı vardır | [Notlar](docs/docs/concepts/notes.md), [Tag](docs/docs/concepts/tags.md) |
| Toplu içe aktarma | CSV/Excel, kolon eşleme, satır bazlı hata inceleme, import oturumu | [Import](docs/docs/concepts/data_import.md) |
| Dışa aktarma | Filtreye uyan bütün kayıtların CSV/XLSX/TSV çıktısı, BOM/stok özetleri | [Export](docs/docs/concepts/data_export.md) |
| Rapor ve baskı etiketleri | Şablonlar, PDF üretimi, varlıklar ve yazdırma | [Rapor](docs/docs/report/index.md) |
| Bildirim ve abonelik | Parça/kategori takibi, düşük stok bildirimi, bildirim kutusu ve e-posta; bildirim/e-posta SQL hazırlığı vardır | [Bildirim](docs/docs/part/notification.md) |
| Webhook ve API anahtarları | Webhook uçları/mesajları ve API anahtarı yaşam döngüsü; webhook SQL hazırlığı vardır | [Tasarım](docs/database/elysia-prisma/DESIGN.md), [ApiKey](docs/database/elysia-prisma/optimized/modules/users.md) |
| Genel arka plan işleri | Kalıcı iş kuyruğu, durum/başarısız iş yönetimi; mevcut kur yenileme yalnız süreç içi timer'dır | [İşler](docs/docs/settings/tasks.md) |

Uygulama kapsamı: `apps/api/src/app.ts`, `apps/api/src/modules/order/controller.ts`, `apps/api/src/modules/common/controller.ts`, `apps/api/prisma/schema.prisma` ve `apps/web/src/features/`.

## 4. Var olan fakat kısmi kalan alanlar

| Alan | Mevcut | Eksik / farklı |
| --- | --- | --- |
| Fiyatlandırma | Tedarikçi, iç maliyet ve satış fiyat bantları; döviz dönüşümü | BOM maliyet toplamı, min/max fiyat özeti, PartPricing cache'i ve otomatik yeniden hesaplama |
| Stok işlemleri | Ekleme, düşme, sayım, taşıma, hareket geçmişi | Stok birleştirme ve montajı bileşenlerine sökerek stoğa döndürme |
| Stok geçmişi | Kalem hareketleri ve sayım tarihi | PartStocktake ile dönemsel toplam miktar/değer snapshot'ları ve tarihsel stok değerlemesi |
| Barkod | barcodeData ve hash alanları | Tarama/çözümleme API'si, okutma, kayda gitme ve tarama geçmişi |
| Parametreler | Parça parametreleri, şablonlar, kategori varsayılanları, choices/checkbox | Diğer iş modellerine ortak yönetim ve seçim listesi entegrasyonu; seçim listelerinin SQL migration'ı vardır |
| Fiziksel birimler | Temel birimler, alias ve pozitif katsayıyla dönüşüm | Daha geniş fiziksel birim ve mühendislik gösterimi desteği |
| Global arama | Menü/komut ve modül içi arama | Farklı iş kayıtlarını birlikte arayan global sonuç ekranı |

Referanslar: [fiyat](docs/docs/part/pricing.md), [stok işlemleri](docs/docs/stock/adjust.md), [söküm](docs/docs/stock/disassemble.md), [stok geçmişi](docs/docs/part/stocktake.md), [barkod](docs/docs/barcodes/index.md), [parametre](docs/docs/concepts/parameters.md), [birimler](docs/docs/concepts/units.md), [arama](docs/docs/concepts/ui/global_search.md).

### Satınalma davranış farkları

- Referans satır bazında farklı para birimine izin verir; `purchase-orders/lines/service.ts` satır para biriminin siparişle eşleşmesini ister.
- Referans takipli parçayı seri numarası olmadan teslim almaya izin verir; mevcut receive yolu seri numarasını zorunlu kılan stok oluşturma yoluna gider.
- Referans tam teslimde otomatik tamamlanma tarif eder; mevcut receive yalnız stok ve teslim miktarını günceller. Ayrı tamamla işlemi vardır.

Kaynaklar: [satınalma referansı](docs/docs/purchasing/purchase_order.md), `apps/api/src/modules/order/purchase-orders/lines/service.ts`, `apps/api/src/modules/order/purchase-orders/receive/service.ts`.

Bunlar InvenTree davranışı hedeflendiğinde farktır; bilinçli sadeleştirme olmaları mümkündür.

## 5. Migration düzeltmesi ve şema uyumsuzluğu

[20261101010000_common_helpers](apps/api/prisma/migrations/20261101010000_common_helpers/migration.sql) aşağıdaki 13 tabloyu oluşturur:

- `tag`, `tagged_item`
- `selection_list`, `selection_list_entry`
- `note`, `notes_image`
- `attachment`
- `notification_entry`, `notification_message`
- `webhook_endpoint`, `webhook_message`
- `email_thread`, `email_message`

Ayrıca `parameter_template.selectionlist_id` alanını ve ilgili foreign key'i ekler.

Bu alanlar için doğru durum **SQL migration var; güncel Prisma modelleri, servis/API ve UI entegrasyonu eksik** şeklindedir. İlk değerlendirmede bunları tamamen sıfırdan başlanacak iş gibi düşünmek yanlıştı. Migration'ın gerçek DB'ye uygulanıp uygulanmadığı incelenmedi. Sonraki migration dosyalarında bu tabloları kaldıran ifade bulunmadı.

Önce migration geçmişi ile Prisma şeması uzlaştırılmalı; aynı tabloları tekrar oluşturan migration yazılmamalıdır.

## 6. Otomatik olarak eksik sayılmayan farklar

- Django `Permission`, `UserPermission`, `GroupPermission` tablolarının bulunmaması bilinçli RuleSet/Better Auth tasarımının parçasıdır.
- Kullanıcı kimliklerini PostgreSQL UUID'ye çevirmek yerine mevcut TEXT kimliklerini korumak sonraki proje kararıdır.
- SSO, MFA/2FA, SCIM, eklenti sistemi, makine sürücüleri ve ayrı mobil istemci temel stok/üretimden ayrı kapsam kararlarıdır.
- InvenTree'den veri göçü için tamamlanmış ETL yoktur. Mevcut kurulumdan geçiş yapılacaksa gerekir; sıfırdan kurulumda aynı önceliği taşımaz.

Kaynaklar: [proje kararları](specs/IMPACT_LATEST.md), [hedef tasarım sınırı](docs/database/elysia-prisma/DESIGN.md), [göç belgesi](docs/database/elysia-prisma/MIGRATION.md).

BOM mirası, alternatif parçalar, stok hareket geçmişi, kalite test kayıtları, üretim tahsisi/tüketimi ve döviz yenilemesinin mevcut uygulamaları vardır. Bunlar bütünüyle yok sayılmamalıdır.

## 7. İnceleme anındaki önerilen sıra

Stok–satınalma–üretim odağı varsayımıyla:

1. Mevcut hesaplama farkları, özellikle pieceCount; migration–Prisma uyumsuzluğu.
2. Mevcut ekranların gerçek servislerle ve backend düzenleme işlemleriyle tamamlanması.
3. Dosya ekleri, import/export, temel PDF/etiket ve gereken arka plan işleri.
4. Ürün kapsamına alınırsa satış/sevkiyat, transfer emirleri, iade.
5. Maliyetlendirme, stok değerleme, fason üretim ve söküm — yalnız ürün kapsamına alınırsa.
6. İhtiyaca bağlı kurumsal entegrasyonlar, eklenti, makine ve mobil istemci.

Bu sıra tarihsel öneridir. Kullanıcının sonraki kararı currency ve fasonun kaldırılması, e-posta kullanılmaması ve username ile giriş yönündedir; bu rapor o karardan önceki karşılaştırmayı saklar.

## Kanıt sınırı

Bu çalışma ana yetenekler ve seçilmiş kritik iş akışları düzeyindedir; tüm alanların birebir eşliği veya bütün hata yollarının denetimi değildir. InvenTree referansını karşılamak muhasebe, finans ve İK içeren tam ERP olmakla aynı hedef değildir. Hiçbir test veya canlı DB işlemi yapılmadı.
