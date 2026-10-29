# InvenTree → Elysia / Prisma / PostgreSQL şema paketi

Kullanılacak sürüm **[optimized/prisma](optimized/prisma/schema.prisma)**. Mevcut yapıyı kontrol etmek için **[current/prisma](current/prisma/schema.prisma)**, modül belgeleri ve **[alan eşleme listesi](FIELD-MAPPING.md)** yan yana tutuldu. Her klasördeki `.prisma` dosyaları birlikte tek şemadır; bir modül dosyası tek başına kullanılmaz.

Kaynak: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`, inceleme tarihi 29 Ekim 2026. Projeye ait **79 somut model / 897 fiziksel alan** çıkarıldı. Soyut sınıflardan gelen alanlar, örtük PK, MPTT alanları, para birimi eşleri, özel durum anahtarları ve API token oluşturma tarihi bu sayıya dahildir.

| Çıktı | İçerik |
|---|---|
| [Mevcut PostgreSQL şeması](current/schema.sql) | 79 proje modeli + 11 doğrudan kullanılan Django/auth/taggit/döviz destek tablosu: **90 tablo / 940 sütun** |
| [Hedef PostgreSQL şeması](optimized/schema.sql) | Better Auth dönüşümüyle **93 tablo / 962 sütun** |
| [Mevcut Prisma](current/prisma/schema.prisma) | Eski tablo/sütun adlarını koruyan kaynak bazlı karşılaştırma modeli |
| [Hedef Prisma](optimized/prisma/schema.prisma) | Prisma ORM **7** sözdizimi, PostgreSQL, camelCase API alanları, snake_case SQL adları |
| [Alan eşlemesi](FIELD-MAPPING.md) | 897 kaynak alanının tamamının hedefi veya dönüşüm nedeni |
| [Geçiş planı](MIGRATION.md) | Kullanıcı eşleme, veri aktarımı, ağaçlar, doğrulamalar ve açılış sırası |
| [Kararlar ve servis kuralları](DESIGN.md) | Nelerin değiştiği, hangi kuralların yalnızca şemayla çözülemeyeceği |
| [Kapsam / dış bağımlılıklar](SCOPE.md) | Mevcut şemanın kanıt sınırı ve framework tablolarının hedef karşılığı |
| [Doğrulama raporu](VALIDATION.md) | Yapılan SQL ve bütünlük kontrolleri; çalıştırılmayan kontroller |

## Modül modül

Tablo sayıları fiziksel model sayısıdır. Sanal ters ilişkiler veya soyut sınıflar ayrı tablo sayılmaz.

| Modül | Mevcut | Hedef | Hedefteki ana karar |
|---|---:|---:|---|
| Kimlik ve erişim | [6](current/modules/auth.md) | [9](optimized/modules/auth.md) | User UUID; Better Auth User, Session, Account, Verification; grup/izin tabloları korunur |
| Kullanıcı profili ve sahiplik | [4](current/modules/users.md) | [4](optimized/modules/users.md) | Owner için user/group FK + XOR; ApiToken → ApiKey, ham token yerine hash |
| Parça kataloğu / BOM / fiyatlar | [13](current/modules/part.md) | [13](optimized/modules/part.md) | MPTT kaldırılır, variantOf/parent korunur; decimal ve tüm fiyat bantları korunur |
| Firma / tedarikçi / üretici | [6](current/modules/company.md) | [6](optimized/modules/company.md) | Firma rolleri, üretici parçası, tedarikçi SKU ve paket miktarı korunur |
| Stok / depo / test | [5](current/modules/stock.md) | [5](optimized/modules/stock.md) | Stok sorgu indeksleri, seri numarası koşullu UNIQUE, miktar CHECK, version |
| Siparişler | [14](current/modules/order.md) | [14](optimized/modules/order.md) | Satın alma, satış, iade ve transfer ayrı kalır; satırlar, ek satırlar ve tahsisler korunur |
| Üretim | [3](current/modules/build.md) | [3](optimized/modules/build.md) | Build / BuildLine / BuildItem; BOM ve stok tahsisi FK'leri korunur |
| Ortak işlevler | [21](current/modules/common.md) | [21](optimized/modules/common.md) | Ayarlar, parametreler, notlar, ekler, bildirim, webhook, e-posta ve çıktı kayıtları korunur |
| Rapor ve etiket | [4](current/modules/report.md) | [4](optimized/modules/report.md) | Şablon dosya yolları, snippet ve asset kayıtları korunur |
| İçe aktarma | [3](current/modules/importer.md) | [3](optimized/modules/importer.md) | Oturum / kolon eşlemesi / satır; işleme kuyruğu için birleşik indeks |
| Eklentiler | [3](current/modules/plugin.md) | [3](optimized/modules/plugin.md) | Eklenti ve kullanıcı ayarları korunur; Python eklenti çalışma kodu ayrıca taşınır |
| Makineler | [2](current/modules/machine.md) | [2](optimized/modules/machine.md) | Mevcut makine UUID'si ve sürücü ayarları korunur |
| SCIM | [1](current/modules/scim.md) | [1](optimized/modules/scim.md) | Yapılandırma/digest alanları korunur; SCIM protokol servisi ayrıca gerekir |
| Türler / etiketler | [3](current/modules/system.md) | [3](optimized/modules/system.md) | ContentType → ModelType; Tag/TaggedItem ilişkileri korunur |
| Döviz | [2](current/modules/currency.md) | [2](optimized/modules/currency.md) | Sağlayıcı, baz para birimi ve Decimal(20,6) kur tablosu korunur |

Her modül belgesinde alanlar, PostgreSQL tipleri, NULL davranışı, varsayılanlar, FK'ler, silme davranışı, benzersizlikler ve indeksler bulunur. İngilizce model açıklamaları doğrudan kaynaktan korunmuştur.

## Kullanım

Hedef klasör yeni fork'a bağımsız olarak kopyalanabilir. Bu paket backend uygulamasını değiştirmez; Elysia iş servislerinin şeması ve entegrasyon örnekleridir. Mevcut Django veritabanına `db push` çalıştırılmamalıdır: hedef adlandırma ve kullanıcı kimlik türü farklıdır.

1. `optimized/` klasörünü fork'ın veri katmanı olarak alın. Prisma 7 için `prisma`, `@prisma/client`, `@prisma/adapter-pg` aynı kesin sürüme sabitlenmelidir. Better Auth sürümü de fork'ın lockfile'ında sabitlenmelidir.
2. [prisma.config.ts](optimized/prisma.config.ts) içindeki `DATABASE_URL` yeni ve boş bir PostgreSQL veritabanını göstermelidir. PostgreSQL 15+ hedeflenmiştir; bu paketteki test motoru ayrıca raporda belirtilmiştir.
3. Önce şema doğrulaması ve migration taslağı üretin:

   ```sh
   bunx prisma validate --config ./prisma.config.ts
   bunx prisma migrate dev --create-only --name initial_inventory --config ./prisma.config.ts
   ```

4. Oluşan migration SQL'inin sonuna [constraints.sql](optimized/constraints.sql) içeriğini ekleyin. Bu dosya CHECK ve koşullu UNIQUE kısıtlarını taşır; **yalnızca `.prisma` dosyalarını uygulamak yeterli değildir**. Sonraki migration'larda bu kısıtlar korunmalıdır.
5. Migration'ı inceleyip yeni geliştirme DB'sinde uygulayın, ardından `bunx prisma generate --config ./prisma.config.ts` çalıştırın. Üretim açılışı [geçiş planına](MIGRATION.md) göre yapılır.

[schema.sql](optimized/schema.sql), bütün şemanın okunabilir ve bağımsız SQL eşdeğeridir; testler bu dosyayı çalıştırır. Prisma migration yolu seçildiyse ayrıca `schema.sql` çalıştırmayın. SQL dosyalarının kısıt/indeks isimleri Prisma'nın üreteceği isimlerle birebir aynı olmak zorunda değildir; Prisma migration geçmişine `schema.sql` doğrudan baseline olarak verilmemelidir.

Örnekler: [Prisma bağlantısı](optimized/examples/db.ts), [Better Auth](optimized/examples/auth.ts), [Elysia oturum kontrolü](optimized/examples/app.ts), [JSON / Decimal sınırı](optimized/examples/dto.ts). Bunlar entegrasyon başlangıcıdır; kullanıcı oluşturma, e-posta doğrulama, parola sıfırlama ve iş yetkilendirme uçları tamamlanmış uygulama olarak sunulmaz.

## Tekrar üretme

```sh
python3 docs/database/elysia-prisma/tools/build.py
```

Çıkarım Django'yu başlatmaz, DB'ye bağlanmaz. [catalog.json](current/catalog.json) özgün alan tanımlarını, kalıtım kökenlerini ve kaynak dosyası hash'lerini içerir. Tekrar üretme `current/`, `optimized/` içindeki şemaları ve modül belgelerini günceller. Elle verilen tasarım kararları `tools/build.py` içinde merkezileştirilmiştir. Çalışan Django ortamının tam fiziksel tablosu ayrıca [runtime_dump.py](tools/runtime_dump.py) ile okunabilir.

## Resmî referanslar

- [Better Auth çekirdek veri modeli](https://better-auth.com/docs/concepts/database): kimlik/oturum/hesap/doğrulama ayrımı ve kimlik üretimi.
- [Better Auth Prisma adaptörü](https://better-auth.com/docs/adapters/prisma): adaptör kurulumu ve migration sorumluluğu.
- [Better Auth Elysia entegrasyonu](https://better-auth.com/docs/integrations/elysia): handler bağlama ve oturum okuma.
- [Prisma 7 çok dosyalı şema](https://www.prisma.io/docs/orm/v7/prisma-schema/overview/location): tüm modüllerin tek klasörden yüklenmesi.
- [Prisma 7 şema referansı](https://www.prisma.io/docs/orm/v7/reference/prisma-schema-reference): PostgreSQL alan türleri, ilişkiler ve indeks tanımları.

Bu paket Prisma 7'yi açık hedef olarak seçer; kurulu önbellekte bulunan Prisma 8 RC farklı CLI/şema akışına sahiptir ve doğrulama için kullanılmamıştır.
