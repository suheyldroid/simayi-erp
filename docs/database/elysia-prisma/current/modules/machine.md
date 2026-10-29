# Makine ve sürücüler

Varyant: **current**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/machine.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## MachineConfig

Tablo: `machine_machineconfig`. A Machine objects represents a physical machine.

Kaynak: `src/backend/InvenTree/machine/models.py:18`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `uuid` | Hayır | PK; Django: uuid.uuid4 |
| `name` → `name` | `varchar(255)` | Hayır | UNIQUE |
| `machine_type` → `machine_type` | `varchar(255)` | Hayır |  |
| `driver` → `driver` | `varchar(255)` | Hayır |  |
| `active` → `active` | `boolean` | Hayır | Django: True |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## MachineSetting

Tablo: `machine_machinesetting`. This models represents settings for individual machines.

Kaynak: `src/backend/InvenTree/machine/models.py:135`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `key` → `key` | `varchar(50)` | Hayır |  |
| `value` → `value` | `varchar(2000)` | Hayır |  |
| `machine_config_id` → `machine_config_id` | `uuid` | Hayır |  |
| `config_type` → `config_type` | `varchar(1)` | Hayır |  |

**İlişkiler**

- `machine_config_id` → `MachineConfig.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `machine_config_id, config_type, key`.
- INDEX: `machine_config_id`.

