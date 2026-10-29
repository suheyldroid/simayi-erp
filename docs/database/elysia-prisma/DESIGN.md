# Hedef tasarım kararları ve uygulama sözleşmesi

“JS optimized”, veri kaybettiren sadeleştirme anlamında kullanılmadı. Alanlar ve iş ayrımları korundu; JavaScript erişim biçimi, PostgreSQL bütünlüğü ve sorgu yolları iyileştirildi. İndeksler kodda görülen erişim alanlarına dayalı öneridir; gerçek veri üzerinde ölçülmüş hızlanma iddiası yoktur.

## Ortak kurallar

| Konu | Mevcut | Hedef / gerekçe |
|---|---|---|
| Adlandırma | Django app_model tabloları, snake_case ve IPN/MPN/SKU alanları | PascalCase model, camelCase alan, snake_case SQL; `@map` / `@@map` açık |
| İş kaydı kimliği | Genelde 32-bit AutoField | `Int @default(autoincrement())` korunur; JS Number için güvenlidir ve veri aktarımı basittir |
| Kullanıcı kimliği | auth_user.id integer | Better Auth User.id UUID string; bütün gerçek User FK'leri UUID |
| Var olan UUID PK | Makine, webhook mesajı, e-posta mesajı/thread | UUID korunur; mesaj/thread PK alan ismi `id` olur |
| 64-bit sayı | reference_int BigInteger | BigInt kalır; JSON'a string çevrilir, Number'a zorlanmaz |
| Para ve miktar | Decimal / MoneyField | Kaynaktaki precision/scale aynen; MoneyField miktar + para birimi sütunu |
| Tarih | DateField / DateTimeField | `date` ve `timestamptz(6)` ayrımı korunur; iş günü ile zaman damgası karıştırılmaz |
| Null | blank ve null ayrı kavramlar | Nullability korunur. `blank=True` tek başına nullable yapılmaz |
| JSON | metadata / ayar / çıktı / payload | `jsonb`; ilişkisel çekirdek tablolar JSON içine gömülmez |
| Durum | Sayısal temel durum + isteğe bağlı özel anahtar | Int korunur, kapalı PostgreSQL enum'a dönüştürülmez; özel durumlar çalışabilsin |
| MPTT | lft/rght/tree_id/level | Bu 4 alan dört gerçek MPTT modelinden kaldırılır; parent/variantOf FK + recursive CTE |
| İndeks | Kaynakta FK indeksleri ve az sayıda birleşik indeks | Kaynak UNIQUE'ler korunur; hedef sorgu birleşik indeksleri eklenir, kapsanan tekli indeksler azaltılır |
| Eşzamanlılık | Django transaction/lock kodu | Kritik kayıtlarda `version`; servis transaction + koşullu güncelleme / kilitleme uygular |

`@updatedAt` Prisma davranışıdır; doğrudan SQL güncellemeleri tarihi kendiliğinden değiştirmez. PostgreSQL mikrosaniyesi JS Date milisaniyesinden hassastır; güncelleme çatışması tespiti için tarih eşitliği yerine `version` kullanılmalıdır.

Dinamik Python varsayılanları (parça ayarları, batch kodu, sipariş referansı, para birimi, token bitiş günü, rapor sayfa boyutu) SQL'e uydurma sabitler olarak çevrilmedi. Şemada kaynak ifadesi yorumda saklıdır; hedef servis bu değerleri açıkça sağlamalıdır. Zorunlu bir alanda default yoksa Prisma create girdisinin bu alanı istemesi kasıtlıdır.

## Kimlik, izin ve sahiplik

Better Auth çekirdeği `User`, `Session`, `Account`, `Verification` modelleridir. `Account.password` yeni sağlayıcının hash biçimini taşır; eski Django password alanı User'a kopyalanmaz. Session token ve OAuth sağlayıcı tokenları Better Auth'un sözleşmesiyle tutulur; uygulama bunları API yanıtına sızdırmaz. Uygulamaya özgü ApiKey ise rastgele üretilmiş yüksek entropili anahtarın SHA-256/HMAC hash'ini ve yalnızca gösterim önekini saklar; bu model Better Auth API-key eklentisinin şeması değildir.

Grup üyeliği, tekil izinler ve `RuleSet` ayrı kalır. Better Auth oturum açılması stok/sipariş yetkisi vermek için tek başına yeterli değildir. Elysia servisinde eski `users/ruleset.py` kapsamlarının karşılığı ve `isActive` kontrolü gerekir. `isStaff` / `isSuperuser` yalnızca yönetim koduyla yazılmalıdır. `UserProfile.active` profil bilgisi; `User.isActive` oturum erişim kararıdır.

Owner, eski `ContentType + owner_id` yerine nullable `userId` ve `groupId` kullanır. SQL `num_nonnulls(user_id, group_id) = 1` kontrolü tam bir hedef ister; her hedef üzerinde UNIQUE vardır. Diğer tablolar Owner.id üzerinden bağlanmaya devam eder. Kullanıcı/grup silinmesi Owner'ı silebilir; Owner'a bağlanan iş modellerinin SetNull/Restrict davranışı korunur. İşlem kayıtlarını tutmak için normal kullanıcı kapatma yolu `isActive=false` olmalıdır.

Bu tasarım tek InvenTree kurulumunun veri modelidir. Better Auth organization, 2FA, passkey, SSO/SCIM veya API-key eklentileri etkin varsayılmadı. Seçilen eklentiler için resmî CLI ile ek şema üretilip farkı incelenmelidir. Firma (`Company`) tablosu bir tenant/organization değildir; kullanıcı izolasyonu vaat etmez.

## Parçalar, BOM ve ağaçlar

Part'ın varyant ağacı `variantOfId`, revizyon bağlantısı `revisionOfId` ile ayrı tutulur. PartCategory ve StockLocation `parentId`, Build de `parentId` kullanır. StockItem'ın parent/belongsTo bağlantıları MPTT değildir; mevcut anlamları korunur. `pathstring` isim yolu cache'i korunur, taşınan dalda servis tarafından tekrar hesaplanır.

Recursive CTE okuma için yeterlidir; çevrimleri tek başına önlemez. Dal taşıma işlemi aynı transaction içinde üst/alt zinciri kontrol etmeli ve rakip taşıma işlemlerini ortak advisory lock veya uygun satır kilitleriyle sıraya almalıdır. Varyant ailesi bulma, eskiden tree_id kullanan seri numarası denetimi ve inherited BOM hesapları da yeni ağaca göre yazılmalıdır.

BomItem miktar, rawAmount, setupQuantity, attrition, roundingMultiple, pieceCount, optional/consumable/inherited/allowVariants alanları korunur. Aynı parçanın farklı referanslarla BOM'da bulunabilmesi ihtimali nedeniyle kaynakta olmayan `(partId, subPartId)` UNIQUE eklenmedi. Döngüsel BOM, uygun parça tipi ve birim/formül validasyonu servis sorumluluğudur.

Fiyat cache'i `PartPricing` korunur. Kaynaktaki çok sayıda min/max fiyat ve ayrı para birimi sütunu tek bir JSON'a veya tek bir currency alanına indirgenmedi. Cache invalidation, kur değişiminde yeniden hesaplama ve fiyat bandı seçimi servis/worker işidir. Döviz sağlayıcı/rate tabloları eklendi; haricî kur toplama servisi burada uygulanmadı.

## Stok, üretim ve siparişler

- `StockItem(partId, serial)` yalnızca serial NULL/boş değilken benzersizdir. Varyant ailesi veya global seri benzersizliği ayarını bu indeks karşılamaz; ilgili aile/global anahtarda transaction kilidi ve sorgu gerekir.
- Stok miktarı ve açıkça kaynakta bulunan sayısal alt/üst sınırlar hedef SQL CHECK olarak yazılır. Kaynaktaki negatif fiyata izin verilen alanlar bu nedenle otomatik olarak pozitif fiyatla sınırlanmaz.
- Stok ayırma, sevk, teslim alma, üretim tüketimi ve transfer sırasında okuma + doğrulama + yazma tek transaction içinde olmalıdır. Allocation toplamı başka satırlara bağlı olduğu için CHECK ile güvenceye alınmaz.
- `version` eklenen modeller: Part, StockItem, Build ve dört sipariş türü. Servis `WHERE id=? AND version=?` ile güncellemeli ve version'ı artırmalıdır. Bu alan tek başına otomatik concurrency koruması değildir; çok satırlı işlemlerde kilit/transaction ayrıca gerekir.
- Satın alma satırındaki `partId` **SupplierPart**'a, satış/transfer satırındaki `partId` **Part**'a bağlanır. İade satırı StockItem'a bağlanır; bu farklar korunmuştur.
- Üretim çıktısı ve tüketilen stok farklı bağlantılardır (`buildId`, `consumedById`). BuildItem, BuildLine ve StockItem arasındaki tahsis tablosudur; `installIntoId` seçmeli çıktı hedefidir.
- Nullable alan içeren bileşik UNIQUE'ler PostgreSQL'de NULL değerleri eşit saymaz. Özellikle BuildItem `(buildLineId, stockItemId, installIntoId)` ve bazı parça/tedarikçi alanları için kaynak davranışı korundu; NULLS NOT DISTINCT varsayılmadı.
- Decimal nesneleri miktar veya para hesabında JS Number'a çevrilmez. JSON API'de decimal string sözleşmesi kullanılır; istemci de miktarı string olarak gönderir.

## Ortak modüller ve genel ilişkiler

ModelType, Django ContentType'ın platform bağımsız karşılığıdır. `(appLabel, model)` benzersizdir ve yalnızca servis tarafından yönetilir. Parametre, not, etiket ve attachment'ın hedef kaydına olan genel ilişkisi **doğrudan hedef tabloya FK değildir**. Hedef tür kaydı için FK olması, hedef iş kaydının varlığını garanti etmez. Ek/parametre/not servisleri hedefi allowlist üzerinden bulmalı, varlığını ve yetkisini kontrol etmeli, silme sırasında genel kayıtları temizlemelidir. UUID kullanıcı veya makineye genel ek bağlama, korunmuş integer modelId sütunlarıyla desteklenmez; ihtiyaç varsa ayrı tasarım değişikliğidir.

Bir hedefe yalnızca bir primary, template olmayan Note kısıtı koşullu UNIQUE ile korunur. SelectionList.defaultId'nin aynı listeye ait olması, Parameter.templateId ile hedef model türünün uyumu ve parametre unique politikasının kapsamı servis tarafından doğrulanır. Şema bu çapraz kayıt iş kurallarını tamamlanmış olarak sunmaz.

Metadata JSON için nesne/NULL kontrolü eklendi; serbest payload/context/headers alanları keyfi biçimde nesneye zorlanmadı. Ayar değerleri String olarak korunur: eski boolean, sayısal, seçim ve gizli ayar codec'leri tip tanımları üzerinden taşınmalıdır. Gizli ayar ve webhook secret değerleri için saklama/şifre çözme politikası uygulama katmanında belirlenmelidir.

Webhook, bildirim ve e-posta kayıtları korunur. Teslimat garantisi, yeniden deneme, idempotency, e-posta thread eşlemesi, bildirim TTL ve temizlik işleri tablo varlığından otomatik doğmaz. DataImportSession/Row ile DataOutput da kuyruk çalıştırıcısı değildir; worker'lar bu durumları günceller.

## Silme ve varsayılanlar

Django `on_delete` çoğunlukla ORM collector davranışıdır; PostgreSQL FK'sindeki ON DELETE CASCADE ile aynı şey değildir. `current` karşılaştırmasında SQL FK'ler NoAction/deferrable gösterilir, kaynak Django silme kararı ayrıca yazılır. `optimized` ilişkileri kaynak kararını DB eylemine çevirir: CASCADE → Cascade, SET_NULL → SetNull, PROTECT/RESTRICT → Restrict, DO_NOTHING → NoAction.

Bu çeviri Django `delete()`, signal ve clean() yan etkilerini taşımaz. Ağaçları üst düğüme bağlama, dosya silme, stok geçmişi oluşturma, maliyet yenileme ve bağlı genel kayıtların temizliği açık Elysia servis işlemi olmalıdır. Özellikle doğrudan Prisma `delete` çağrıları iş servisinin yerine kullanılamaz.
