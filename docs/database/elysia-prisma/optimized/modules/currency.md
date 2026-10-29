# Döviz kuru sağlayıcısı ve kurlar

Varyant: **optimized**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/currency.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## ExchangeBackend

Tablo: `exchange_backend`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `name` → `name` | `varchar(255)` | Hayır | PK |
| `lastUpdate` → `last_update` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama güncelleme zamanı |
| `baseCurrency` → `base_currency` | `varchar(3)` | Hayır |  |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## Rate

Tablo: `rate`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `currency` → `currency` | `varchar(3)` | Hayır |  |
| `value` → `value` | `numeric(20,6)` | Hayır |  |
| `backendId` → `backend_id` | `varchar(255)` | Hayır |  |

**İlişkiler**

- `backendId` → `ExchangeBackend.name`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `currency, backendId`.
- INDEX: `backendId`.

