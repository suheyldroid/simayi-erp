# Döviz kuru sağlayıcısı ve kurlar

Varyant: **current**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/currency.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## ExchangeBackend

Tablo: `exchange_exchangebackend`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `name` → `name` | `varchar(255)` | Hayır | PK |
| `last_update` → `last_update` | `timestamptz(6)` | Hayır | Uygulama güncelleme zamanı |
| `base_currency` → `base_currency` | `varchar(3)` | Hayır |  |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## Rate

Tablo: `exchange_rate`. Explicit dependency support model; see scope notes.

Kaynak: `tools/build.py:1`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement() |
| `currency` → `currency` | `varchar(3)` | Hayır |  |
| `value` → `value` | `numeric(20,6)` | Hayır |  |
| `backend_id` → `backend_id` | `varchar(255)` | Hayır |  |

**İlişkiler**

- `backend_id` → `ExchangeBackend.name`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `currency, backend_id`.
- INDEX: `backend_id`.

