---
name: structure-frontend-resources
description: Enforces this project's layered frontend routes (auth-only root, global system shell, `/o/$organizationSlug` membership boundary with sibling `_workspace` and `settings` shells) plus resource index (pagination + Actions) and detail/show architecture under apps/web. Use when creating, changing, or reviewing resource index, list, show, or detail pages, their create/update Sheet forms, their routes, or the dashboard, organization workspace and organization settings navigation layers.
---

# Structure Frontend Resources

## Kapsam ve öncelik

- Bu kural `apps/web` altındaki uygulama katmanlarını ve iş kaynaklarının frontend sayfalarını kapsar: global pano, organizasyon çalışma alanı, ayar merkezleri, liste/index ve detay/show.
- Buradaki **kaynak**, ID ile adreslenebilen, index'te listelenmeye ve bağımsız bir show sayfasında tek başına açılmaya uygun iş kaydı koleksiyonudur. Dashboard, auth, genel uygulama ayarları, tekil (singleton) formlar ve kayıt koleksiyonu olmayan toplulaştırma/akış ekranları bu kapsama girmez; onlara iki sayfalı CRUD kalıbını zorla uygulama.
- `AGENTS.md`, mevcut paylaşılan bileşenler ve mevcut token stili bu rehberden önce gelir.
- Mevcut ekranları yalnızca açıkça istendiğinde veya o özelliğin gerçek görevi kapsamında taşı. Bu iskeleti kurmak için toplu migrasyon başlatma; gelecekteki kaynakları gerekçe göstererek mevcut kapsam dışındaki sayfaları yeniden yazma.
- Yeni bir tablo katmanı, tema, form çerçevesi veya istemci veri deposu icat etme; `components/data-table`, `components/ui` ve mevcut semantic token'ları kullan.

## Uygulama katmanları

Sayfaların hangi kabukta ve hangi erişim koşuluyla açıldığı kaynak sayfasının parçasıdır. Katmanları birbirine karıştırma.

| Katman | Route | Erişim | İçerik |
| --- | --- | --- | --- |
| Oturumlu kök | `_authenticated` (URL değil) | Oturum; `beforeLoad` oturumu doğrular. | Yalnızca auth guard, oturum hatası/yeniden deneme ve `Outlet`. Sidebar, organizasyon bağlamı veya iş sorgusu çizmez. |
| Global sistem kabuğu | `_system` pathless altında `/`, `/organization`, `/system-settings`, `/users`, `/settings`, `/settings/account`, `appearance`, `display`, `notifications`, `/errors/$error` | Yalnızca oturum; `/system-settings` ve `/users` ayrıca native platform yöneticisi (`user.role` içinde `admin`). | Global sidebar (Dashboard, Organizations, yalnızca platform yöneticisine System settings) ve kişisel hesapla ilgili ekranlar. Organizasyon switcher, organizasyon sidebar'ı, `OrganizationGate` ve tenant detay sorgusu burada yoktur. |
| Organizasyon sınırı | `/o/$organizationSlug/route.tsx` (kendi sayfası yok, tüm alt rotaların ortak sınırı) | URL'deki slug native üyelikle eşleşen aktif organizasyon; `session.activeOrganizationId` üyeliğin organizasyon kimliğine eşit olmalı ve `activeMember.organizationId` yeniden doğrulanmalı; eşleşmeden alt içerik mount edilmez. Bilinmeyen veya üye olunmayan slug fail-closed not-found. | Yalnızca doğrulama ve `Outlet`. Sidebar, `SidebarProvider`, komut menüsü, organizasyon bağlamı veya iş sorgusu çizmez. İki alt kabuk bu sınırın kardeş çocuklarıdır. |
| Organizasyon çalışma alanı kabuğu | `_workspace` pathless altında `/o/$organizationSlug`, `/supplier`, `/stock-items`, `/purchasing`, `/sales` (+ `$id` detayları) | Organizasyon sınırı. | Çalışma alanı sidebar'ı (`useOrganizationSidebarNav`), OrganizationSwitcher, `Back to system` ve kendi komut menüsü. Overview, tedarikçi, stok, satınalma ve satış kayıtları buradan açılır. |
| Organizasyon iniş sayfası | `/o/$organizationSlug` | Organizasyon çalışma alanı kabuğu. | Etkin organizasyonun çalışma alanı/özeti (`features/organization-dashboard`). |
| Organizasyon ayarları kabuğu | `/o/$organizationSlug/settings` ve `/settings/{items,item-categories,recipes,manage}` (+ `$id` detayları) | Organizasyon sınırı; girdiler aynı organizasyon üyeliğiyle açılır. | Kendi `OrganizationSettingsLayout` kabuğu ve ayarlara özel sidebar (`useOrganizationSettingsSidebarNav`): Overview, Items, Item categories, Recipes ve Organization management; ayrıca `Back to organization` ve kendi komut menüsü. Organizasyon switcher'ı, Suppliers, Stock items, Purchasing veya Sales yoktur. |
| Organizasyon ayarları merkezi | `/o/$organizationSlug/settings` | Organizasyon ayarları kabuğu. | Genel bakış kartları dört girişi (Items, Item categories, Recipes, Organization management) yeni `/settings/...` yollarına bağlar; özel izin kapısı yoktur. İkinci bir veri modeli yoktur. |
| Organizasyon yönetimi | `/o/$organizationSlug/settings/manage` | Organizasyon ayarları kabuğu; yönetim işlemleri native Better Auth organizasyon kurallarına tabidir. | Mevcut organizasyon detayı: üyeler, takımlar, native `owner`/`admin`/`member` rol seçimi ve organizasyon düzenleme/silme. Bağlantı üyelik düzeyindedir; dinamik rol veya iş izni yönetimi yoktur. |
| Çalışma alanı iş rotaları | `/o/$organizationSlug/{supplier,stock-items,purchasing,sales}` (+ `$id` detayları) | Organizasyon çalışma alanı kabuğu + aynı organizasyon üyeliği. | Kaynak index ve detay sayfaları. Aktif organizasyon yokken iş kaydı render etme. |
| Katalog iş rotaları | `/o/$organizationSlug/settings/{items,item-categories,recipes}` (+ `$id` detayları) | Organizasyon ayarları kabuğu + aynı organizasyon üyeliği. | Katalog index ve detay sayfaları; detaylar da organizasyon ayarları kabuğunda kalır. |
| Kişisel ayarlar | `/settings`, `/settings/account`, `appearance`, `display`, `notifications` | Yalnızca oturum. | Global kişisel tercihler. Organizasyon seçimi veya iş izni gerektirmez. |

- Kenar çubuğu üç ayrı kabuğa aittir; hiçbiri alt bilgi (footer) çizmez ve kabuklar birbirinin içine geçmez. `_system` kabuğu yalnızca global grubu taşır: Dashboard (`/`), Organizations (`/organization`) ve yalnızca platform yöneticisine System settings (`/system-settings`). Organizasyon sınırı (`/o/$organizationSlug/route.tsx`) hiçbir sidebar, `SidebarProvider` veya komut menüsü çizmez. `Organization` grubu yalnızca çalışma alanı kabuğunda (`_workspace`) görünür: Overview (`/o/$organizationSlug`), Suppliers, Stock items, Purchasing, Sales ve Organization settings (`/o/$organizationSlug/settings`); ayrıca açık bir `Back to system` bağlantısı (`/`) ve OrganizationSwitcher taşır. Ayarlar kabuğu (`settings/route.tsx`, `OrganizationSettingsLayout`) kendi `Organization settings` grubunu taşır: Overview (`/o/$organizationSlug/settings`), Items, Item categories, Recipes ve Organization management. Tüm bağlantılar aynı organizasyon üyeliğiyle açılır; özel izin kapısı yoktur. Ayar sidebar'ında `Back to organization` (`/o/$organizationSlug`) bağlantısı vardır; organizasyon switcher'ı, Suppliers, Stock items, Purchasing veya Sales yoktur. Liste girdileri detay rotalarında da etkin kalır (`matchChildren`), Overview tam eşleşmeyle işaretlenir. Ayarlar sidebar verisi `useOrganizationSettingsSidebarNav(organizationSlug)`, çalışma alanı sidebar verisi `useOrganizationSidebarNav(organizationSlug)` ile üretilir; her kabuk kendi `CommandMenu`'sünü kendi gruplarıyla çizer ve çalışma alanı komut menüsü yalnızca çalışma alanı gruplarını, ayarlar komut menüsü yalnızca filtrelenmiş ayar gruplarını taşır.
- Katalog rotaları (`items`, `item-categories`, `recipes`) ve detayları yalnızca `/o/$organizationSlug/settings/...` altındadır; katalog detayı da ayar kabuğunda kalır. Stok, satınalma veya başka bir çalışma alanı ekranından kataloğa geçen her bağlantı yeni `/settings/...` yoluna gitmelidir ki doğru kabuk açılsın. Eski `/items`, `/item-categories`, `/recipes` ve `/manage` yollarını alias veya yönlendirme olarak yaşatma; kaldırılan `/permissions` yolunu geri getirme.
- Global sistem katmanı tenant'a dokunmaz: bu kabukta `OrganizationSwitcher`, organizasyon sidebar'ı/iş bağlantıları, `OrganizationGate` veya tenant detay sorgusu render edilmez; global oturum sorgusu yalnızca native hesap bilgisini okur, organizasyon erişim projeksiyonu istemez. Oturumda aktif organizasyon bulunması sistem kabuğunu organizasyona bağlamaz.
- Global bir sayfayı ziyaret etmek etkin organizasyonu temizlemez, `setActive` çağırmaz, organizasyon pinlemez/dondurmaz ve tenant sorgusu başlatmaz. Sistem kabuğundan organizasyon detayına geçiş yalnızca gezinmedir; organizasyon etkinleştirme kararı `/o/$organizationSlug` sınırının içinde verilir.
- `/` ve `/organization` yalnızca kullanıcının gerçek hesap bilgilerini ve native üyelik özetlerini gösterir. `Details` eylemi `row.original.slug` ile `/o/$organizationSlug` adresine saf tipli `Link`'tir; panoda `Enter workspace` mutasyonu veya `organizationApi.enter` çağrısı yoktur. Örnek satış, uydurma metrik, boş iskelet kart veya listelenmemiş organizasyon üretme.
- Organizasyon oluşturma mevcut aktif organizasyonu değiştirmez. Yeni organizasyonun detayına geçiş kullanıcının açık gezinmesidir; Create Sheet içinde `setActive` çağırma.
- `/system-settings` platform-genel ve yalnızca Users içindir. Burada aktif organizasyon, iş izni veya tenant detay sorgusu zorunlu kılma; platform yöneticisi olmayan kullanıcıya Users girişi gösterme.
- `/o/$organizationSlug/settings` organizasyon ayarları kabuğundadır. Items, Item categories, Recipes ve Organization management aynı organizasyon üyeliğiyle açılır; özel izin/RBAC kapısı ekleme. Organization management işlemleri Better Auth'un native üye/takım kurallarına tabidir. Genel bakış girişleri yalnızca gezinme kartlarıdır; kart içinde satır içi işlem veya create akışı barındırma.
- Organizations yalnızca global panoda ve global `/organization` dizininde yaşar; sistem ayarları veya organizasyon ayarları merkezine taşınmaz. Üye/takım/rol yönetimi global dizinde değil, organizasyon sınırındaki `/o/$organizationSlug/settings/manage` sayfasındadır.
- Kişisel ayarlar `/settings` altında global kalır; organizasyon bağlamı dayatma. İş izinleri görünümü yoktur ve geri eklenmez.
- Organizasyon sınırı slug'ı native üyeliklerden gerçekten çözer (`useOrganizationBoundary()` → `{ organizationId, organizationSlug, organization }`); bilinmeyen veya üye olunmayan slug fail-closed not-found ile kapanır. URL slug'ının çözdüğü üyelik ile `session.activeOrganizationId` farklıysa yalnızca sınır içinde native `setActive` çağrılır, pin/freeze uygulanır ve aynı kanonik slug URL'sine tam belge yeniden yüklemesi yapılır. `organizationApi.enter(organizationId, '/o/<slug>')` yalnızca aynı kökenli kanonik organizasyon URL'sini hedef alır; `/workspace`, global yol veya yabancı köken reddedilir. Slug yeniden adlandırıldığında yeni kanonik organizasyon köküne (`/o/<yeni-slug>`) gidilir, ayar alt yolu taşınmaz ve global üyelik listesi geçersiz kılınır; eski slug'da kalınmaz. Kanonik slug mevcut native `Organization.slug` (`@unique`) alanından okunur; yeni şema veya migration eklenmez. Bu rota kendi başına sidebar veya sağlayıcı çizmez; doğrulama `Outlet` altındaki iki kardeş kabuğun sorgularını da aynı şekilde kapılar. Cross-tab freeze, native üyelik ve backend guard'ları korunur.
- İş rotaları organizasyon sınırı ve aktif organizasyon olmadan açılmaz. Global sayfalar için iş guard'ını zayıflatma, iş sayfaları için aktif organizasyon/membership denetimini kaldırma. İstemcinin gönderdiği organization, slug veya kayıt ID'si yetki vermez; kiracı sınırı ve organizasyon kapsamı backend'de kalır. Slug'dan türetilmiş yeni bir tenant başlığı uydurma.

## Dosya yapısı

```text
apps/web/src/routes/_authenticated/
├── route.tsx                       # yalnızca auth guard + Outlet
├── _system/
│   ├── route.tsx                   # global sistem kabuğu (global sidebar)
│   ├── index.tsx                   # / → features/dashboard
│   ├── organization/index.tsx      # /organization → features/organization
│   ├── system-settings/index.tsx   # /system-settings → features/system-settings
│   ├── users/{index,$userId}.tsx   # /users → features/users
│   ├── settings/                   # /settings (+ account, appearance, display, notifications)
│   └── errors/$error.tsx           # /errors/$error
└── o/$organizationSlug/
    ├── route.tsx                   # organizasyon sınırı: doğrulama + Outlet, chrome yok
    ├── _workspace/                 # çalışma alanı kabuğu (pathless)
    │   ├── route.tsx               # OrganizationWorkspaceLayout
    │   ├── index.tsx               # /o/$organizationSlug → features/organization-dashboard
    │   ├── supplier/               # /o/$organizationSlug/supplier
    │   ├── stock-items/            # /o/$organizationSlug/stock-items
    │   ├── purchasing/             # /o/$organizationSlug/purchasing
    │   └── sales/                  # /o/$organizationSlug/sales
    └── settings/                   # organizasyon ayarları kabuğu
        ├── route.tsx               # OrganizationSettingsLayout (ayarlara özel sidebar)
        ├── index.tsx               # /o/$organizationSlug/settings → features/organization-settings
        ├── items/                  # /o/$organizationSlug/settings/items (+ $itemId)
        ├── item-categories/        # /o/$organizationSlug/settings/item-categories (+ $categoryId)
        ├── recipes/                # /o/$organizationSlug/settings/recipes (+ $recipeId)
        └── manage.tsx              # /o/$organizationSlug/settings/manage → features/organization/show
apps/web/src/features/<resource>/
├── index.tsx                       # index/list sayfası (Actions + Create)
├── show.tsx                        # show/detail sayfası (gerçek kayıt işlemleri)
├── api.ts                          # gerçek uçlar ve model doğrulaması
├── model.ts                        # zod şemaları ve tipler
└── components/                     # form/Sheet ve ayrıştırma gerçekten gerektiğinde
```

- Route dosyaları ince kalır: `createFileRoute` ve `component` yanında gerektiğinde tipli `params`/`search` doğrulaması ile mevcut `beforeLoad`/`loader` guard'larını barındırabilir; UI ve iş mutasyonları feature içinde kalır. Her doğrulamayı zorunlu olarak UI'a taşımaya çalışma.
- Route kimlikleri tam yolu izler: sistem ekranları `/_authenticated/_system/...`, çalışma alanı ekranları `/_authenticated/o/$organizationSlug/_workspace/...`, katalog ve ayar ekranları `/_authenticated/o/$organizationSlug/settings/...`. Kaldırılan düz iş rotalarına, `/workspace`'e, `/o/$organizationSlug/{items,item-categories,recipes,manage}` gibi eski ayar dışı yollara veya `/organization/$organizationId` detayına geri dönme; eski route'u alias olarak yaşatma.
- TanStack tipli route kimlikleri: katalog detayları `/_authenticated/o/$organizationSlug/settings/{items,item-categories}/$id` ve `/_authenticated/o/$organizationSlug/settings/recipes/$recipeId`; çalışma alanı detayları `/_authenticated/o/$organizationSlug/_workspace/{supplier,stock-items,purchasing,sales}/$id`.
- URL segmentleri mevcut kaynağın gerçek adını izler (`/o/$organizationSlug/settings/items/`, `/o/$organizationSlug/supplier/`); frontend route adını bahane ederek backend uçlarını yeniden adlandırma.
- Organizasyon kapsamlı her göreli veya dinamik tipli bağlantı `organizationSlug` parametresini korur: `useOrganizationSlug()` (`@/lib/organization-boundary`) veya sınır bağlamından gelen slug `params={{ organizationSlug }}` ile verilir; ek kaynak ID'si varsa `params={{ organizationSlug, itemId }}` olur. `useOrganizationBoundary()` `{ organizationId, organizationSlug, organization }` döndürür. `strict: false` yalnızca tipli parametre korunarak kullanılır; `as any`, elle URL birleştirme veya slug'sız bağlantı yoktur.
- `routeTree.gen.ts` üretilmiş dosyadır: elle düzenleme, üretimi atlatma veya sahte route ekleme.
- Şematik adlar: `<resources>` çoğul URL segmenti, `$<resource>Id` route parametresi, `<Resource>List` ve `<Resource>Detail` bileşenleri.

## Index sayfası

- Kaynağı `SortableDataTable` (`components/data-table/sortable-data-table.tsx`) içinde listele; `data`, düz `SortableColumn<T>[]`, `getRowId`, `caption` ve `emptyMessage` kullan.
- Sayfalama gerçek API sözleşmesiyle yapılır: `limit`/`offset`/`total`. Sayfa durumu sorgu anahtarına girer; `search`/filtre değişince sayfa `0`'a döner.
- Önceki sayfa `page === 0` iken kapalıdır; sonraki sayfa API'nin `total` değerinden türetilir. Varsayılan sayfa sayısı veya istemci tarafı satır sayımı uydurma.
- `components/data-table/pagination.tsx` bir TanStack table instance'ı bekler; sunucudan sayfalanmış satırları ayrıca istemcide sayfalama. Paylaşımlı bileşen açıkça geliştirilmedikçe mevcut sayfa kontrolü desenini API sözleşmesine bağla.
- Mevcut `SortableDataTable` sıralamayı yalnızca eldeki sayfa üzerinde istemci tarafında yapar; `onSortingChange` tek başına sunucu sıralaması sağlamaz. API'nin gerçekten desteklediği genel sıralamayı vaat et; desteklenmeyen kolonlarda `enableSorting: false` kullan veya sıralamayı caption'da sayfa-içi olarak dürüstçe belirt.
- Birincil ad hücresi düz metindir. Kayıt adı/referansı bağlantı, altı çizili metin, tıklanabilir rozet veya satır tıklaması değildir.
- Navigasyon **son sütundadır**: başlığı `Actions`, `enableSorting: false` olan sütun, gerçek kayıt ID'sine giden erişilebilir ve tipli bir `Details` `Link` içerir. Navigasyon ID'si her zaman `row.original.id`'den gelir; `row.index`, görsel sıra numarası veya uydurma bir `/detail` ucu kullanma. `Actions` sütunu sıralama durumuna dahil edilmez.
- Tüm satırı tıklanabilir yapan erişilemez `div`/`onClick`, klavye ile ulaşılamayan tıklama, yalnızca satır tıklamasına dayanan navigasyon veya ad hücresine gömülü bağlantı kullanma; bağlantı görünür ve odaklanabilir olmalıdır.
- Global organizasyon listesinde (`/` ve `/organization`) aynı sütun düzeni geçerlidir. `Details` eylemi saf tipli bir `Link`'tir: `to='/o/$organizationSlug'`, `params={{ organizationSlug: row.original.slug }}`. Panoda `Enter workspace` veya `organizationApi.enter` çağrısı yoktur; global liste organizasyonu etkinleştirmez, yalnızca sınır URL'sine gezinir. Üye/takım/rol yönetimi detayı `/o/$organizationSlug/settings/manage` sayfasındadır.
- Satır menüsü/dropdown, satır seçimi (`selectable`, `rowSelection`), satır içi düzenleme, satır aksiyonu ve toplu aksiyon yoktur. `Actions` sütunu kayıt mutasyonu içermez; yalnızca `Details` navigasyonunu taşır.
- Listenin üstünde, başlık alanında açık bir `Create` girişi **yalnızca** gerçek backend kök oluşturma işlemi varsa bulunur. Bu giriş `components/ui/sheet` ile açılır; uydurma uç, `/new` route'u, boş show sayfası veya sahte oluşturma akışı ekleme. Gerçek uç yoksa girişi hiç gösterme; pasif/sahte buton üretme.
- Ön koşul gerçek uç ve veridir: supplier `supplierApi.save` (POST); stock `stockItemsApi.createItems` (gerçek item seçimi); purchasing `POST /order/purchase-orders/`; sales `POST /sales/` (`recipeId`, `quantity`, `requestKey`; seçim yalnızca etkin reçete verisine bağlıdır); recipe `POST /recipes/`, `PATCH /recipes/:recipeId`, `DELETE /recipes/:recipeId?version=` (ad/açıklama/etkinlik ve gerçek item seçimli malzeme satırları, bir adet başına miktar); item `itemApi.saveItem`; item category `itemCategoryApi.saveCategory`; organization `authClient.organization.create` (mevcut aktif organizasyonu değiştirmez); Users native platform yöneticisi + `authClient.admin.createUser`. Özel iş izni kapısı yoktur. Recipes bağımsız kök kaynaktır: index'te Create Sheet vardır, detay malzemeleri listeler ve montaj item'ı, BOM doğrulama/checksum, kalıtım veya ayrı reçete satırı ucu yoktur.
- Gerçek üst kayıt detayındaki mevcut ilişkili kayıt oluşturma işlemleri (örneğin item detayındaki stok oluşturma) detay sayfasında kalır; bunları index'e taşıma.
- İzin verilenler: listeleme, arama, filtre, sıralama, sayfalama, hata sonrası `Retry`/`refetch`, erişilebilir `Details` navigasyonu ve gerçek uca bağlı `Create` Sheet'i.

```tsx
import { Link } from '@tanstack/react-router'
import { useOrganizationSlug } from '@/lib/organization-boundary'

// Hook, hücre bileşeninde koşulsuz çağrılır; kolon tanımı hook çağırmaz.
function DetailsLink({ item }: { item: ItemRecord }) {
  const organizationSlug = useOrganizationSlug()
  return (
    <Link
      to='/o/$organizationSlug/settings/items/$itemId'
      params={{ organizationSlug, itemId: String(item.id) }}
      aria-label={`View details for ${item.name}`}
      className='rounded-sm text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
    >
      Details
    </Link>
  )
}

// Ad düz metin; son sütun yalnızca gerçek kayıt ID'siyle Details bağlantısı.
const columns: SortableColumn<ItemRecord>[] = [
  {
    id: 'name',
    header: 'Name',
    accessorFn: (item) => item.name,
    cell: ({ getValue }) => String(getValue() ?? ''),
  },
  // … gerçek alanlar …
  {
    id: 'actions',
    header: 'Actions',
    enableSorting: false,
    cell: ({ row }) => <DetailsLink item={row.original} />,
  },
]
```

## Oluşturma ve düzenleme Sheet'i

- Kök oluşturma ve kayıt düzenleme formları mevcut `components/ui/sheet` bileşenini kullanır. Create girişi index'in üstündedir; update girişi kaydın detayındadır veya detaydaki mevcut aksiyondan açılır.
- Sheet yapısı eksiksiz olur: `SheetContent` içinde `SheetHeader` + `SheetTitle` + `SheetDescription`, kaydırılabilir gövde ve `SheetFooter` içinde iptal/gönder. Responsive genişlik kullan (`w-full` + uygun `sm:max-w-*`); dar ekranda taşan veya gövdesi kaydırılamayan Sheet bırakma.
- Oluşturma/düzenleme için `Dialog`, satır içi editör, ayrı `/new` route'u veya sayfa içine gömülü ikinci bir form katmanı kullanma. `Dialog` yalnızca yıkıcı onay içindir.
- Form durumu açılan gerçek kayda bağlıdır: update'te kayıt ID'si `row.original.id` veya detay kaydından gelir; her açılışta alanlar o kaydın gerçek değerleriyle kurulur ve kapanışta sıfırlanır. Önceki satırın değerini, liste önbelleğinden uydurma detayı veya boş varsayılan kaydı forma taşıma.
- Form yalnızca `model.ts` içindeki gerçek Zod sözleşmesini ve `api.ts` içindeki gerçek ucu kullanır; olmayan alan, endpoint veya iş yeteneği uydurma.
- Mevcut `version` iyimser eşleşme kuralını koru; Item'da ayrı bir kayıt kilidi, şablon, varyant veya revizyon durumu yoktur. Item formu yalnızca ad, açıklama, kategori, birim, görsel, IPN, varsayılan son kullanma, minimum stok ve etkinlik alanlarını taşır. Sahiplik yalnızca aynı organizasyondaki metadata seçimidir, erişim kapısı değildir. Güncelleme gövdesini API'nin beklediği alanlardan kur; istemci nesnesini olduğu gibi gönderme.
- Kiracı iş formlarında gönderim özel izin sorgusuna bağlanmaz; form yalnızca gerçek kayıt, doğrulama, sürüm ve veri ön koşullarına bağlıdır. Platform-genel Users formunda native platform yöneticisi kapısı korunur. İstek sürerken gönderimi devre dışı bırak ve hatayı `role="alert"` ile göster.
- Başarılı mutasyondan sonra ilgili liste ve detay sorgularını geçersiz kıl. Kiracı kapsamlı anahtarlarda aktif organizasyon kapsamı korunur; platform-genel kaynaklarda gerçek global anahtarlar kullanılır. Başka organizasyonun önbelleğini geçersiz kılma.
- Silme ve diğer yıkıcı işlemler mevcut `ConfirmDialog` (`components/confirm-dialog.tsx`, `AlertDialog`) ile onaylanır; bunları Sheet içine taşıma veya onay adımını atlama.

## Show (detail) sayfası

- Kaydı route ID'siyle çek: feature dosyası route dosyasını import etmeden `@tanstack/react-router` içindeki tipli `useParams({ from: <gerçek route ID> })` veya `getRouteApi(<gerçek route ID>)` kullan; buradaki değer o kaynağın `createFileRoute` çağrısındaki tam yoldur, şablon yer tutucu değil. Organizasyon kapsamlı kaynakta tam kimlik `/_authenticated/o/$organizationSlug/settings/items/$itemId` (katalog) veya `/_authenticated/o/$organizationSlug/_workspace/supplier/$supplierId` (çalışma alanı) gibidir; `organizationSlug` parametresi de okunur ve alt bağlantılarda korunur. Mevcut kalıp gerektiriyorsa ince route sarmalayıcısı doğrulanmış ID'yi prop olarak geçebilir. Gelen gerçek ID'yi kaynağın ID tipine doğrula (örneğin pozitif tam sayı); geçersiz ID'de API çağrısı yapmadan not-found durumu göster.
- Sorgu anahtarı kiracı kapsamlı kaynaklarda kaynak, aktif organizasyon ve kayıt ID'sini içerir. Doğrudan bağlantı ve sayfa yenileme çalışmalıdır; seçili satır durumuna, `location.state`'e veya önceki liste önbelleğine bağımlı olma.
- Yalnızca gerçek kaynak alanlarını ve yanıtın gerçekten döndürdüğü ilişkileri göster. Liste cache'inden uydurma detay, varsayılan kayıt veya boş kayıt render etme; backend'de show ucu yoksa uç eklenmesi ön koşuldur.
- Gerçek iş aksiyonlarını (düzenleme, silme, mevcut durum işlemleri) burada barındır; düzenleme Sheet'i açar, silme `ConfirmDialog` ister. Yalnızca backend'in sunduğu yetenekleri kullan; yeni iş yeteneği uydurma.
- Mutasyonlar mevcut API ve React Query ile yapılır; başarıdan sonra hem detay hem liste sorgularını kiracı kapsamlı kaynaklarda aktif organizasyonla sınırlı, platform-genel kaynaklarda gerçek global anahtarlarla geçersiz kıl. Silme sonrası navigasyonu güvenli yap; silinmiş kaydın detayında kalma.
- Kök oluşturma index'in üstündeki Create Sheet'idir. Detay sayfasında yalnızca backend'in gerçekten sunduğu ilişkili kayıt oluşturma akışlarını koru; `/new` route'u veya boş kayıtlı show sayfası icat etme.

## Veri, önbellek ve erişim

- Kiracı kapsamlı liste anahtarları kaynak + aktif organizasyon + sayfalama/filtre/arama/sıralama; detay anahtarları kaynak + aktif organizasyon + kayıt ID'si içerir. `organizationCacheScope()` yardımcısı `@/lib/tenant` içindedir. Platform-genel (organizasyona bağlı olmayan) kaynaklarda yapay organizasyon kapsamı üretme.

```ts
import { organizationCacheScope } from '@/lib/tenant'

// liste
queryKey: ['<resource>', organizationCacheScope(), 'list', page, search, filter, sort]
// detay
queryKey: ['<resource>', organizationCacheScope(), 'detail', recordId]
```

- İstemcinin gönderdiği organization veya kayıt ID'si erişim yetkisi vermez; kiracı sınırı ve organizasyon kapsamı backend'de kalır. UI'da gizlenen buton güvenlik sayılmaz.
- Özel iş izni, RBAC, dinamik rol veya `permissionsQuery`/`hasPermission` kapısı yoktur; aynı organizasyonun tüm üyeleri iş verisini okur ve gerçek uç varsa değiştirir. Platform `user.role` (`admin`) yalnızca native hesap ekranlarını (`/users`) kapılar; organization `owner`/`admin`/`member` rolleri native üye/takım yönetimi kurallarıdır, iş verisi görünürlüğü vermez veya kısıtlamaz.
- Kiracı iş kaynaklarında veri yalnızca organizasyon sınırı ve gerçek yükleme durumuna bağlıdır; izin sorgusu bekleme/hata durumu uydurma. Platform-genel `/`, `/organization` ve `/system-settings` ekranlarında yalnızca global native hesap/platform-admin sınırını kullan; bu kabukta zorunlu aktif organizasyon veya tenant detay sorgusu dayatma. Organizasyon ayarları kabuğunda (`/o/$organizationSlug/settings`) Items, Item categories, Recipes ve Organization management aynı üyelik düzeyindedir.
- Global sistem kabuğu organizasyon erişim projeksiyonu istemez: `sessionQuery` yalnızca native hesabı (`GlobalSession`; `access` alanı yok) okur ve tenant başlığı/pin/freeze kullanmaz. Organizasyon erişimi/aktif üyelik bilgisi yalnızca `/o/$organizationSlug` sınırı içinde `organizationSessionQuery` (`['organization','session']`, `/me`, yalnızca kullanıcı ve oturum), slug'dan çözülen native üyelik ve `activeMember.organizationId` ile doğrulanır. `session.activeOrganizationId` üyeliğin organizasyon kimliğine eşit olmadan alt içerik mount edilmez. Global kaynaklara yapay organizasyon kapsamı eklenmez.
- Auth'u yeniden yazma; organizasyon dışı içerik bir an bile görünmemeli. Global bir sayfaya geçiş aktif organizasyonu sıfırlamamalı, `setActive` çağırmamalı ve pin/freeze uygulamamalı; iş sayfaları aktif organizasyon yokken veri istememeli.
- API adlarını ve sözleşmeleri koru; frontend route adları backend `index`/`show` uçlarının yeniden adlandırılmasını gerektirmez.
- Backend'i bu frontend kuralı kapsamında yeniden tasarlama; yalnızca gerçekten gereken uç/alan eksikliğini ön koşul olarak bildir.

## Durumlar

- Liste: yükleniyor (`role="status"`), hata (`role="alert"` + `Retry`) ve boş liste durumları birbirinden ayrıdır.
- Detay: yükleniyor, hata + yeniden dene ve API açıkça 404 döndürdüğünde bulunamadı durumu gösterilir. Özel izin/RBAC yok durumu üretilmez. Kaydın varlığını çıkarımla açığa çıkarma ve backend'in bilinçli 404 gizlemesini başka bir duruma dönüştürme.
- Sheet: form yüklenirken/gönderilirken `role="status"` veya disabled gönderim, hata `role="alert"`; başarısız gönderimde Sheet açık kalır ve kullanıcının girdisi korunur.
- Arama/filtre değişimi sayfayı sıfırlar; sayaç ve "sonraki sayfa" gerçek API yanıtından türetilir.
- Aynı kaynağı iki kez sayfalama, iki ayrı kaynaktan gelen toplamı karıştırma veya istemci tarafı sahte toplam üretme.

## Görsel, erişilebilirlik ve React

- Mevcut Cursor Dark, köşeli ve semantic token stilini koru (`bg-background`, `text-muted-foreground`, `border-border`, `text-destructive`); gradyan, gölge veya yeni tema katmanı ekleme.
- Paylaşılan `components/ui` bileşenlerini ve `components/data-table` stilini kullan; tabloyu veya temayı değiştiren ikinci bir katman yazma.
- Erişilebilir başlık hiyerarşisi, `caption`/`aria-label`, klavye odağı ve görünür focus halkası sağla. `Actions` bağlantısı ekran okuyucuda kaydı ayırt eden bir ada sahip olmalıdır.
- Sheet'te başlık ve açıklama erişilebilir olmalı; odak tuzağı ve kapanış davranışı mevcut Radix bileşeninden gelir, elle ikinci bir modal katmanı kurma.
- Responsive davranışı mevcut kırılım ve `content` container kurallarıyla uyumlu tut; RTL'de yön duyarlı mantıksal sınıflar (`ms-`/`me-`, `start`/`end`) kullan.
- React kuralları: hooks koşulsuz, bağımlılıklar eksiksiz, gereksiz state/effect yok; sorgu ve mutasyon durumları React Query'den okunur.
- Ekran metinleri bulunduğu bölümün mevcut dilini izler; aynı ekranda dil karıştırma.

## Statik kabul kontrolü

- `AGENTS.md` test politikası geçerlidir: test yazma veya çalıştırma, tarayıcı/manüel doğrulama yapma. Bu kontrol listesi kod incelemesidir, test senaryosu değildir.
- İzin verilen statik komutlar yalnızca gerçek web script'leridir: `cd apps/web && bun run build`, `cd apps/web && bun run lint` ve yalnızca yazılan/değişen dosyalar için `bun run prettier --check <dosya>`. `apps/web` içinde `check-types` script'i yoktur; test çalıştırma.
- İncelemede doğrula:
  - Her hedef kaynakta ince route dosyaları var: çalışma alanı için `_authenticated/o/$organizationSlug/_workspace/<resource>/index.tsx` ve `$<resource>Id.tsx`, katalog için `_authenticated/o/$organizationSlug/settings/<resource>/index.tsx` ve `$<resource>Id.tsx`; sayfa bileşenleri `features/<resource>/index.tsx` + `show.tsx` içinde. `routeTree.gen.ts` elle değiştirilmemiş.
  - `_authenticated/route.tsx` yalnızca auth guard ve `Outlet` çiziyor; `_system/route.tsx` global sidebar'ı taşıyor ve organizasyon switcher'ı, organizasyon sidebar'ı, `OrganizationGate` veya tenant detay sorgusu içermiyor.
  - `/o/$organizationSlug/route.tsx` yalnızca doğrulama + `Outlet` çiziyor; sidebar, `SidebarProvider` veya komut menüsü içermiyor. Altında iki kardeş kabuk var: pathless `_workspace` çalışma alanı sidebar'ını, `settings/route.tsx` ise `OrganizationSettingsLayout` ve ayarlara özel sidebar'ı taşıyor; iç içe sidebar veya ikinci `SidebarProvider` yok.
  - `/` oturumla açılıyor, kullanıcının gerçek bilgilerini ve native üyelik özetlerini gösteriyor; aktif organizasyon yoksa kapanmıyor, varsa temizlenmiyor ve sistem kabuğu tenant verisi istemiyor.
  - `/o/$organizationSlug` sınırı URL slug'ını native üyeliklerden çözüyor; `session.activeOrganizationId` o üyeliğin organizasyon kimliğine eşit ve `activeMember.organizationId` yeniden doğrulanmış olmadan çocuk/outlet mount etmiyor. Bilinmeyen veya üye olunmayan slug fail-closed not-found. Gerekli `setActive` + pin/freeze + belge yeniden yüklemesi yalnızca sınır içinde; doğrulama iki kardeş kabuğun alt sorgularını da kapılıyor.
  - `/system-settings` yalnızca native platform yöneticisine Users gösteriyor ve organizasyon/iş kartı içermiyor; organizasyon ayarları kabuğu (`/o/$organizationSlug/settings`) aktif organizasyon ister, sidebar'ında yalnızca Overview, Items, Item categories, Recipes ve Organization management taşır. Tüm girdiler aynı organizasyon üyeliğiyle görünür; özel izin kapısı yoktur. Ayar sidebar'ında organizasyon switcher'ı, Suppliers, Stock items, Purchasing veya Sales yok; `Back to organization` `/o/$organizationSlug` adresine gidiyor.
  - Organizations global panoda ve `/organization` dizininde; üye/takım/rol yönetimi `/o/$organizationSlug/settings/manage` altında. İki ayar merkezinde de organizasyon kartı yok. Kişisel ayarlar `/settings` altında global; iş izinleri görünümü yok.
  - Katalog `items`, `item-categories` ve `recipes` rotaları `/o/$organizationSlug/settings/...` altında ve detayları da ayar kabuğunda; stok/satınalma gibi çalışma alanı ekranlarından kataloğa geçen bağlantılar yeni `/settings/...` yollarına gidiyor. Eski `/items`, `/item-categories`, `/recipes` veya `/manage` yolu alias olarak yaşatılmıyor; kaldırılan `/permissions` yolu yok.
  - Global sayfaya geçiş aktif organizasyonu temizlemiyor, `setActive` çağırmıyor, pin/freeze uygulamıyor; iş rotaları organizasyon sınırı ve aktif organizasyon olmadan veri göstermiyor ve tenant/membership guard'ları zayıflatılmamış.
  - Index'te kayıt adı düz metin; son sütun `Actions` ve `enableSorting: false`; `Details` tipli `Link` gerçek `row.original.id` kullanıyor ve organizasyon kapsamlı bağlantı `organizationSlug` parametresini koruyor. Satır tıklaması, satır menüsü, satır seçimi, satır içi düzenleme veya ad hücresinde bağlantı yok. Panodaki ve `/organization` dizinindeki `Details` saf `Link` ile `row.original.slug` üzerinden `/o/$organizationSlug` adresine gidiyor; `Enter workspace` veya `organizationApi.enter` mutasyonu yok.
  - `Create` yalnızca gerçek backend kök create işlemi varsa listenin üstünde açık giriş olarak var; gerçek `model.ts`/`api.ts` kullanıyor, uydurma uç veya `/new` route'u yok. Gerçek uç yokken sahte/pasif create girişi yok.
  - Create/update formları `components/ui/sheet` kullanıyor; `SheetHeader` + `SheetTitle` + `SheetDescription`, kaydırılabilir gövde, `SheetFooter` ve responsive genişlik var. Dialog, satır içi editör veya ikinci form katmanı kullanılmamış. Silme/yıkıcı onay `ConfirmDialog` ile.
  - Formlar gerçek kayda bağlı; önceki satırın değeri, liste önbelleğinden uydurma kayıt veya boş varsayılan taşınmıyor. `version` eşleşmesi korunuyor; Item'da ayrı kayıt kilidi yok; sahiplik yalnızca aynı organizasyon metadata seçimi.
  - Sayfalama `limit`/`offset`/`total` ile uyumlu, arama/filtre sayfayı sıfırlıyor, çift sayfalama yok.
  - Kiracı kapsamlı liste anahtarları kaynak + organizasyon + sayfalama/filtre/arama/sıralama, detay anahtarları kaynak + organizasyon + kayıt ID'si içeriyor; platform-genel kaynaklara organizasyon kapsamı uydurulmamış; organizasyon sınırı render'dan önce.
  - Show doğrudan route ID'siyle yükleniyor; liste önbelleği veya seçili satıra bağımlı değil.
  - Yükleniyor/hata/boş/bulunamadı durumları ayrı; organizasyon dışı içerik parlaması yok.
  - Mutasyonlar mevcut API'yi kullanıyor, doğru kapsamda detay + listeyi geçersiz kılıyor, silme sonrası navigasyon güvenli.
  - Mevcut token stili ve paylaşılan bileşenler kullanılmış; yeni tablo/tema katmanı yok.
  - Uydurma detay, uydurma iş yeteneği, `/new` route'u veya sahte oluşturma akışı yok.
