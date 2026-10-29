# Doğrulama raporu

Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

## Çalıştırılan kontroller

Her varyant ayrı, boş, yalnızca bellekte yaşayan PGlite 0.3.15 PostgreSQL motorunda oluşturuldu. Kullanıcının mevcut DB'sine bağlantı kurulmadı. Sonuçlar [validation-results.json](validation-results.json) dosyasında bulunur.

| Kontrol | Sonuç |
|---|---|
| Mevcut SQL CREATE TABLE / FK / UNIQUE / INDEX / CHECK | Başarılı: 90 tablo, 940 sütun |
| Hedef SQL CREATE TABLE / FK / UNIQUE / INDEX / CHECK | Başarılı: 93 tablo, 962 sütun |
| 79 kaynak modelin bütün fiziksel alanlarının mevcut şemada temsili | Başarılı: 897 alan |
| Prisma dosyalarındaki model/alan varlığı, isim çakışması, ilişki hedefi, scalar/native tip uyumu, ters ilişki ve SetNull nullability | Başarılı; özel yapısal kontrol |
| Better Auth çekirdek tablolarına beklenen alanlarla kayıt ve UUID User FK | Başarılı; adaptör çalıştırılmadı |
| Owner hedefinin boş veya aynı anda user+group olması | CHECK ile reddedildi |
| Owner için var olmayan grup | FK ile reddedildi |
| Aynı parçada aynı dolu seri | UNIQUE ile reddedildi; NULL ve boş seri tekrarları kabul edildi |
| Farklı parçada aynı seri | Kabul edildi; global/aile ayarı servis sorumluluğu |
| Negatif stok miktarı | CHECK ile reddedildi |
| Metadata'nın JSON array olması | CHECK ile reddedildi |
| Decimal `9999999999.99999` stok miktarı | Tam hassasiyetle yazıldı ve okundu |
| Aynı hedefe ikinci primary, template olmayan not | UNIQUE ile reddedildi; template not ayrı davranışını korudu |
| Aynı version üzerinden ikinci güncelleme | Koşullu UPDATE sıfır satır döndürdü |

## Çalıştırılmayan kontroller

**Resmî Prisma 7 `prisma validate`, client generation ve Better Auth adaptörü ile uçtan uca giriş testi çalıştırılmadı.** Yerel önbellekte yalnızca Prisma 8 RC vardı. Prisma 7 sürüm kontrolü için npm erişimi ortamın ağ kısıtına takıldı; istenen ek ağ izni kullanıcı tarafından reddedildi. İzin tekrarlanmadı veya başka yoldan ağ erişimi denenmedi. Mevcut yerel PGlite paketi SQL doğrulaması için kullanıldı.

Yapısal Prisma kontrolü, Prisma parser/type checker yerine geçmez. PostgreSQL SQL testleri de Prisma-generated migration veya Better Auth runtime uyumluluğunun tamamını kanıtlamaz. PGlite PostgreSQL WASM motorudur; hedef sunucunun sürümü, collation, timezone, extension, yük ve connection-pool davranışı ayrıca doğrulanmalıdır.

Canlı DB introspection, bütün Django migration zincirini uygulama, üretim verisi aktarımı, eşzamanlı gerçek bağlantılardan yarış testleri ve bütün iş akışlarının JS portu yapılmadı. Performans benchmark'ı yapılmadı.

## Tekrar çalıştırma

Yerel kurulu PGlite varsa:

```sh
node docs/database/elysia-prisma/tools/verify.mjs
```

Alternatif olarak birinci argümana kurulu `@electric-sql/pglite/dist/index.js` dosyasının mutlak yolu verilebilir. Script haricî DB'ye bağlanmaz. Şema veya tasarım değiştiğinde önce `tools/build.py`, sonra doğrulama çalıştırılır.

Prisma 7 kurulabilen fork ortamında tamamlanacak kontroller: `prisma validate`, `prisma generate`, boş PostgreSQL'e Prisma migration + constraints uygulama, Better Auth sign-in/session/logout ve grup yetkilendirme testi. Eklenti seçilirse Better Auth schema generator çıktısı da bu şemayla karşılaştırılmalıdır.
