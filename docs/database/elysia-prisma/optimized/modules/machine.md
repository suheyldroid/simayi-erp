# Makine ve sürücüler

Varyant: **optimized**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/machine.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## MachineConfig

Tablo: `machine_config`. A Machine objects represents a physical machine.

Kaynak: `src/backend/InvenTree/machine/models.py:18`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `uuid` | Hayır | PK; Prisma: dbgenerated("gen_random_uuid()"); Django: uuid.uuid4 |
| `name` → `name` | `varchar(255)` | Hayır | UNIQUE |
| `machineType` → `machine_type` | `varchar(255)` | Hayır |  |
| `driver` → `driver` | `varchar(255)` | Hayır |  |
| `active` → `active` | `boolean` | Hayır | Prisma: true; Django: True |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## MachineSetting

Tablo: `machine_setting`. This models represents settings for individual machines.

Kaynak: `src/backend/InvenTree/machine/models.py:135`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `key` → `key` | `varchar(50)` | Hayır |  |
| `value` → `value` | `varchar(2000)` | Hayır | Prisma: "" |
| `machineConfigId` → `machine_config_id` | `uuid` | Hayır |  |
| `configType` → `config_type` | `varchar(1)` | Hayır |  |

**İlişkiler**

- `machineConfigId` → `MachineConfig.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `machineConfigId, configType, key`.

