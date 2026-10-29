# Kapsam ve kanıt sınırı

## Mevcut şema neyi gösteriyor?

`current/`, bu checkout'ın Python model tanımlarından çıkarılmış **PostgreSQL eşdeğeridir**. Canlı PostgreSQL'e bağlanılmadı; Django'nun migration graph'ı çalıştırılmadı. Bu nedenle üretimdeki tablo/indeks adlarının, uygulanmış migration seviyesinin veya kurulum eklentilerinin birebir dump'ı değildir.

Kaynak şema kapsamı:

- `src/backend/InvenTree/*/models.py` içindeki 79 somut proje modeli.
- Proje içi soyut sınıf alanları: metadata, referans sayacı, pathstring, barkod, resim, tarih/kullanıcı güncellemeleri, sipariş ve fiyat bandı tabanları.
- Django AutoField; gerçek MPTT kalıtımı olan Part, PartCategory, StockLocation, Build için lft/rght/tree_id/level.
- `InvenTreeModelMoneyField` için miktar ve `_currency`; durum alanları için `_custom_key`; DRF Token'dan gelen `created`.
- Doğrudan referans çözümü için 11 destek tablosu: User, Group, Permission, UserGroup, UserPermission, GroupPermission, ContentType, Tag, TaggedItem, ExchangeBackend, Rate.

`data_exporter`, `web`, `generic` ve çekirdek `InvenTree` modüllerinin ayrı somut model tablosu bulunmadı. Data exporter çıktıları Common.DataOutput üzerinden izlenir. Mixin/TypedDict/QuerySet/enum sınıfları tablo olarak sayılmadı. `Part.default_supplier` mevcut kodda hesaplanan property'dir; eski sürümlerdeki ForeignKey güncel şemaya yanlışlıkla eklenmedi.

Kaynakta `blank=True`, form/uygulama doğrulamasıdır. SQL NULL kararı `null=True` üzerinden çıkarıldı. Django callable default'ları SQL DEFAULT olarak gösterilmedi; kaynak ifadeleri katalog ve modül belgelerinde korunmuştur. `save()`, `clean()`, signal, state transition, property ve validator kuralları fiziksel alan sayılmaz. Hedefe taşınması gereken kritik kurallar [DESIGN.md](DESIGN.md) içindedir.

`current` Prisma modeli, Django FK'lerinin deferrable niteliğini PSL'de ifade edemez. Bağımsız current SQL karşılığı bunu `DEFERRABLE INITIALLY DEFERRED` ile gösterir. İndeks/constraint isimleri kaynak migration'ların tüm geçmiş hash'leriyle birebir eşleşmez. Char/varchar `LIKE` yardımcı indeksleri gibi Django PostgreSQL backend'inin otomatik ek indeksleri ayrıca modellenmedi. Bu nedenlerle current Prisma, mevcut DB'yi yönetmeye başlamak için migration baseline'ı değildir.

## Kurulu framework uygulamalarının durumu

`INSTALLED_APPS` daha geniştir. Aşağıdaki **framework'ün sahip olduğu teknik şemaların tüm kolonları bu pakette çıkarılmış değildir**. Bu fark, 90 tablonun çalışan her InvenTree kurulumundaki toplam tablo sayısı olmadığını özellikle belirtir.

| Kaynak bağımlılık | Hedef kararı / sınır |
|---|---|
| Django sessions, admin log, sites, django_migrations | Better Auth oturumu / Elysia admin ve audit politikası / uygulama config / Prisma migration geçmişi. Eski teknik kayıtlar arşivlenir |
| allauth account/socialaccount/headless/mfa/usersessions | Çekirdek User/Account/Session/Verification hedefte var. E-posta doğrulama ve sosyal hesap verisi geçişte kaynak veriden okunmalı. MFA/SSO/ek session geçmişi için ek Better Auth plugin şeması gerekebilir |
| django_otp otp_totp / otp_static | 2FA kararına bağlı; eski sırlar ve recovery kodları kendiliğinden taşınmaz |
| oauth2_provider | Gelen OAuth ile OAuth authorization server olmak farklıdır. Kaynak uygulamanın client/grant/token hizmeti gerekiyorsa ayrı provider tasarımı gerekir |
| django_q | Task/Schedule/OrmQ ve ilişkili worker teknik kayıtları seçilen JS job altyapısıyla değiştirilir; bu paket bir kuyruk altyapısı kurmaz |
| django_mailbox | Mailbox / Message / MessageAttachment teknik alım tabloları seçilecek e-posta worker'ına bağlıdır. Projeye ait Common.EmailMessage ve EmailThread eksiksiz kapsandı |
| flags, error_report | Feature-flag ve hata raporu altyapısı ayrı; projeye ait iş verisiyle karıştırılmadı |
| djmoney.contrib.exchange | **Kapsandı:** ExchangeBackend ve Rate; tüm MoneyField currency kolonları da var |
| taggit | **Kapsandı:** Tag ve TaggedItem; hedef kayda polymorphic link hâlâ uygulama tarafından doğrulanır |
| Diğer kurulum eklentileri / opsiyonel silk / harici uygulamalar | Çalışan kurulumda kontrol edilmelidir; checkout'tan evrensel bir tablo listesi iddia edilemez |

Tam çalışan DB için `tools/runtime_dump.py` connection introspection ile **bütün fiziksel tabloları**, kolonları ve kısıtları listeler. Django registry'deki modeller ve db_table adları da aynı çıktıda bulunur. Bu script bu çalışmada çalıştırılmadı; çalışan Django bağımlılıkları ve DB erişimi mevcut değildi.

Örnek, depo kökünden ve mevcut Django ortamında:

```sh
python src/backend/InvenTree/manage.py shell --no-imports -c "exec(open('docs/database/elysia-prisma/tools/runtime_dump.py').read())"
```

Script SQL mutation yapmaz. Çalıştıran yönetim komutunun Django başlangıç davranışı mevcut projenin ayarlarına tabidir.

## Bağımlılık modelleri için kaynaklar

- [Django 5.2 auth modelleri](https://github.com/django/django/blob/stable/5.2.x/django/contrib/auth/models.py)
- [django-taggit 6.1.0 modelleri](https://github.com/jazzband/django-taggit/blob/6.1.0/taggit/models.py)
- [django-taggit başlangıç migration'ı](https://github.com/jazzband/django-taggit/blob/6.1.0/taggit/migrations/0001_initial.py)
- [django-money 3.6.1 exchange modelleri](https://github.com/django-money/django-money/blob/3.6.1/djmoney/contrib/exchange/models.py)

Python model default'ları ile PostgreSQL fiziksel default'ları ayrılmıştır. Haricî auth/taggit/döviz modelleri `tools/build.py` içinde açık destek tanımlarıdır; bunlar proje kaynaklarından otomatik bulunmuş 79 modele dahil değildir.
