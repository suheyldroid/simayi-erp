# Ortak işlevler ve ayarlar

Varyant: **current**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/common.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## ProjectCode

Tablo: `common_projectcode`. A ProjectCode is a unique identifier for a project.

Kaynak: `src/backend/InvenTree/common/models.py:154`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `code` → `code` | `varchar(50)` | Hayır | UNIQUE |
| `description` → `description` | `varchar(200)` | Hayır |  |
| `active` → `active` | `boolean` | Hayır | Django: True |
| `responsible_id` → `responsible_id` | `integer` | Evet |  |

**İlişkiler**

- `responsible_id` → `Owner.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `responsible_id`.

## InvenTreeSetting

Tablo: `common_inventreesetting`. An InvenTreeSetting object is a key:value pair used for storing single values (e.g. one-off settings values).

Kaynak: `src/backend/InvenTree/common/models.py:1239`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `key` → `key` | `varchar(50)` | Hayır | UNIQUE |
| `value` → `value` | `varchar(2000)` | Hayır |  |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## InvenTreeUserSetting

Tablo: `common_inventreeusersetting`. An InvenTreeSetting object with a user context.

Kaynak: `src/backend/InvenTree/common/models.py:1334`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `key` → `key` | `varchar(50)` | Hayır |  |
| `value` → `value` | `varchar(2000)` | Hayır |  |
| `user_id` → `user_id` | `integer` | Evet |  |

**İlişkiler**

- `user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `key, user_id`.
- INDEX: `user_id`.

## WebhookEndpoint

Tablo: `common_webhookendpoint`. Defines a Webhook endpoint.

Kaynak: `src/backend/InvenTree/common/models.py:1431`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `endpoint_id` → `endpoint_id` | `varchar(255)` | Hayır | Django: uuid.uuid4 |
| `name` → `name` | `varchar(255)` | Evet |  |
| `active` → `active` | `boolean` | Hayır | Django: True |
| `user_id` → `user_id` | `integer` | Evet |  |
| `token` → `token` | `varchar(255)` | Evet | Django: uuid.uuid4 |
| `secret` → `secret` | `varchar(255)` | Evet |  |

**İlişkiler**

- `user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `user_id`.

## WebhookMessage

Tablo: `common_webhookmessage`. Defines a webhook message.

Kaynak: `src/backend/InvenTree/common/models.py:1588`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `message_id` → `message_id` | `uuid` | Hayır | PK; Django: uuid.uuid4 |
| `host` → `host` | `varchar(255)` | Hayır |  |
| `header` → `header` | `varchar(255)` | Evet |  |
| `body` → `body` | `jsonb` | Evet |  |
| `endpoint_id` → `endpoint_id` | `integer` | Evet |  |
| `worked_on` → `worked_on` | `boolean` | Hayır | Django: False |

**İlişkiler**

- `endpoint_id` → `WebhookEndpoint.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `endpoint_id`.

## NotificationEntry

Tablo: `common_notificationentry`. A NotificationEntry records the last time a particular notification was sent out.

Kaynak: `src/backend/InvenTree/common/models.py:1648`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `updated` → `updated` | `timestamptz(6)` | Evet | Uygulama güncelleme zamanı |
| `key` → `key` | `varchar(250)` | Hayır |  |
| `uid` → `uid` | `varchar(255)` | Hayır |  |

**Kısıtlar ve indeksler**

- UNIQUE: `key, uid`.

## NotificationMessage

Tablo: `common_notificationmessage`. A NotificationMessage is a message sent to a particular user, notifying them of some important information.

Kaynak: `src/backend/InvenTree/common/models.py:1687`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `target_content_type_id` → `target_content_type_id` | `integer` | Hayır |  |
| `target_object_id` → `target_object_id` | `varchar(255)` | Hayır |  |
| `source_content_type_id` → `source_content_type_id` | `integer` | Evet |  |
| `source_object_id` → `source_object_id` | `varchar(255)` | Evet |  |
| `user_id` → `user_id` | `integer` | Evet |  |
| `category` → `category` | `varchar(250)` | Hayır |  |
| `name` → `name` | `varchar(250)` | Hayır |  |
| `message` → `message` | `varchar(250)` | Evet |  |
| `link` → `link` | `varchar(500)` | Evet |  |
| `creation` → `creation` | `timestamptz(6)` | Hayır | Uygulama oluşturma zamanı |
| `read` → `read` | `boolean` | Hayır | Django: False |

**İlişkiler**

- `target_content_type_id` → `ContentType.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `source_content_type_id` → `ContentType.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `source_content_type_id`.
- INDEX: `target_content_type_id`.
- INDEX: `user_id`.

**Sütun olmayan Django alanları**

- `target_object`: `GenericForeignKey`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `source_object`: `GenericForeignKey`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## NewsFeedEntry

Tablo: `common_newsfeedentry`. A NewsFeedEntry represents an entry on the RSS/Atom feed that is generated for InvenTree news.

Kaynak: `src/backend/InvenTree/common/models.py:1766`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `feed_id` → `feed_id` | `varchar(250)` | Hayır | UNIQUE |
| `title` → `title` | `varchar(250)` | Hayır |  |
| `link` → `link` | `varchar(250)` | Hayır |  |
| `published` → `published` | `timestamptz(6)` | Hayır |  |
| `author` → `author` | `varchar(250)` | Hayır |  |
| `summary` → `summary` | `varchar(250)` | Hayır |  |
| `read` → `read` | `boolean` | Hayır | Django: False |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## CustomUnit

Tablo: `common_customunit`. Model for storing custom physical unit definitions.

Kaynak: `src/backend/InvenTree/common/models.py:1796`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `name` → `name` | `varchar(50)` | Hayır | UNIQUE |
| `symbol` → `symbol` | `varchar(10)` | Hayır |  |
| `definition` → `definition` | `varchar(50)` | Hayır |  |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## Attachment

Tablo: `common_attachment`. Class which represents an uploaded file attachment.

Kaynak: `src/backend/InvenTree/common/models.py:1936`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `model_type` → `model_type` | `varchar(100)` | Hayır |  |
| `model_id` → `model_id` | `integer` | Hayır |  |
| `attachment` → `attachment` | `varchar(100)` | Evet |  |
| `thumbnail` → `thumbnail` | `varchar(100)` | Evet |  |
| `link` → `link` | `varchar(2000)` | Evet |  |
| `comment` → `comment` | `varchar(250)` | Hayır |  |
| `upload_user_id` → `upload_user_id` | `integer` | Evet |  |
| `upload_date` → `upload_date` | `date` | Evet | Uygulama oluşturma zamanı |
| `is_image` → `is_image` | `boolean` | Hayır | Django: False |
| `file_size` → `file_size` | `integer` | Hayır | Django: 0 |

**İlişkiler**

- `upload_user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `upload_user_id`.
- SQL CHECK: `"model_id" >= 0`.
- SQL CHECK: `"file_size" >= 0`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.

## InvenTreeCustomUserStateModel

Tablo: `common_inventreecustomuserstatemodel`. Custom model to extends any registered state with extra custom, user defined states.

Kaynak: `src/backend/InvenTree/common/models.py:2277`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `reference_status` → `reference_status` | `varchar(250)` | Hayır |  |
| `logical_key` → `logical_key` | `integer` | Hayır |  |
| `key` → `key` | `integer` | Hayır |  |
| `name` → `name` | `varchar(250)` | Hayır |  |
| `label` → `label` | `varchar(250)` | Hayır |  |
| `color` → `color` | `varchar(10)` | Hayır | Django: ColorEnum.secondary.value |
| `model_id` → `model_id` | `integer` | Evet |  |

**İlişkiler**

- `model_id` → `ContentType.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- UNIQUE: `reference_status, key`.
- UNIQUE: `reference_status, name`.
- INDEX: `model_id`.

## SelectionList

Tablo: `common_selectionlist`. Class which represents a list of selectable items for parameters.

Kaynak: `src/backend/InvenTree/common/models.py:2417`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `name` → `name` | `varchar(100)` | Hayır | UNIQUE |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `locked` → `locked` | `boolean` | Hayır | Django: False |
| `active` → `active` | `boolean` | Hayır | Django: True |
| `source_plugin_id` → `source_plugin_id` | `integer` | Evet |  |
| `source_string` → `source_string` | `varchar(1000)` | Hayır |  |
| `default_id` → `default_id` | `integer` | Evet |  |
| `created` → `created` | `timestamptz(6)` | Hayır | Uygulama oluşturma zamanı |
| `last_updated` → `last_updated` | `timestamptz(6)` | Hayır | Uygulama güncelleme zamanı |

**İlişkiler**

- `source_plugin_id` → `PluginConfig.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `default_id` → `SelectionListEntry.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `default_id`.
- INDEX: `source_plugin_id`.

## SelectionListEntry

Tablo: `common_selectionlistentry`. Class which represents a single entry in a SelectionList.

Kaynak: `src/backend/InvenTree/common/models.py:2548`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `list_id` → `list_id` | `integer` | Evet |  |
| `value` → `value` | `varchar(255)` | Hayır |  |
| `label` → `label` | `varchar(255)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `active` → `active` | `boolean` | Hayır | Django: True |

**İlişkiler**

- `list_id` → `SelectionList.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `list_id, value`.
- INDEX: `list_id`.

## ParameterTemplate

Tablo: `part_partparametertemplate`. A ParameterTemplate provides a template for defining parameter values against various models.

Kaynak: `src/backend/InvenTree/common/models.py:2608`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `model_type_id` → `model_type_id` | `integer` | Evet |  |
| `name` → `name` | `varchar(100)` | Hayır | UNIQUE |
| `units` → `units` | `varchar(25)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `checkbox` → `checkbox` | `boolean` | Hayır | Django: False |
| `choices` → `choices` | `varchar(5000)` | Hayır |  |
| `selectionlist_id` → `selectionlist_id` | `integer` | Evet |  |
| `enabled` → `enabled` | `boolean` | Hayır | Django: True |
| `unique` → `unique` | `integer` | Hayır | Django: UniqueOptions.NONE |

**İlişkiler**

- `model_type_id` → `ContentType.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `selectionlist_id` → `SelectionList.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `model_type_id`.
- INDEX: `selectionlist_id`.
- SQL CHECK: `"unique" >= 0`.

## Parameter

Tablo: `part_partparameter`. Class which represents a parameter value assigned to a particular model instance.

Kaynak: `src/backend/InvenTree/common/models.py:2829`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `updated` → `updated` | `timestamptz(6)` | Evet | Django: None |
| `updated_by_id` → `updated_by_id` | `integer` | Evet |  |
| `model_type_id` → `model_type_id` | `integer` | Hayır |  |
| `model_id` → `model_id` | `integer` | Hayır |  |
| `template_id` → `template_id` | `integer` | Hayır |  |
| `data` → `data` | `varchar(500)` | Hayır |  |
| `data_numeric` → `data_numeric` | `double precision` | Evet | Django: None |
| `note` → `note` | `varchar(500)` | Hayır |  |

**İlişkiler**

- `updated_by_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `model_type_id` → `ContentType.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.
- `template_id` → `ParameterTemplate.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `model_type_id, model_id, template_id`.
- INDEX: `model_type_id`.
- INDEX: `model_type_id, model_id`.
- INDEX: `template_id`.
- INDEX: `updated_by_id`.
- SQL CHECK: `"model_id" >= 0`.

**Sütun olmayan Django alanları**

- `content_object`: `GenericForeignKey`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## Note

Tablo: `common_note`. Class which represents a note assigned to a particular model instance.

Kaynak: `src/backend/InvenTree/common/models.py:3086`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `updated` → `updated` | `timestamptz(6)` | Evet | Django: None |
| `updated_by_id` → `updated_by_id` | `integer` | Evet |  |
| `template` → `template` | `boolean` | Hayır | Django: False |
| `model_type_id` → `model_type_id` | `integer` | Evet |  |
| `model_id` → `model_id` | `integer` | Evet |  |
| `primary` → `primary` | `boolean` | Hayır | Django: False |
| `title` → `title` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır |  |
| `content` → `content` | `text` | Hayır |  |

**İlişkiler**

- `updated_by_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `model_type_id` → `ContentType.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `model_type_id`.
- INDEX: `updated_by_id`.
- SQL CHECK: `"model_id" >= 0`.
- Koşullu benzersizlik `constraints.sql` dosyasında; Prisma şemasının tek başına uygulanması yeterli değildir.

**Sütun olmayan Django alanları**

- `content_object`: `GenericForeignKey`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## NotesImage

Tablo: `common_notesimage`. Model for storing uploading images for the 'notes' fields of various models.

Kaynak: `src/backend/InvenTree/common/models.py:3399`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `image` → `image` | `varchar(100)` | Hayır |  |
| `user_id` → `user_id` | `integer` | Evet |  |
| `date` → `date` | `timestamptz(6)` | Hayır | Uygulama oluşturma zamanı |
| `note_id` → `note_id` | `integer` | Hayır |  |

**İlişkiler**

- `user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.
- `note_id` → `Note.id`; N:1; SQL onDelete `NoAction`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `note_id`.
- INDEX: `user_id`.

## BarcodeScanResult

Tablo: `common_barcodescanresult`. Model for storing barcode scans results.

Kaynak: `src/backend/InvenTree/common/models.py:3433`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `data` → `data` | `varchar(250)` | Hayır |  |
| `user_id` → `user_id` | `integer` | Evet |  |
| `timestamp` → `timestamp` | `timestamptz(6)` | Hayır | Uygulama oluşturma zamanı |
| `endpoint` → `endpoint` | `varchar(250)` | Evet |  |
| `context` → `context` | `jsonb` | Evet |  |
| `response` → `response` | `jsonb` | Evet |  |
| `result` → `result` | `boolean` | Hayır | Django: False |

**İlişkiler**

- `user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `user_id`.

## DataOutput

Tablo: `common_dataoutput`. Model for storing generated data output from various processes.

Kaynak: `src/backend/InvenTree/common/models.py:3497`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `created` → `created` | `date` | Hayır | Uygulama oluşturma zamanı |
| `user_id` → `user_id` | `integer` | Evet |  |
| `total` → `total` | `integer` | Hayır | Django: 1 |
| `progress` → `progress` | `integer` | Hayır | Django: 0 |
| `complete` → `complete` | `boolean` | Hayır | Django: False |
| `output_type` → `output_type` | `varchar(100)` | Evet |  |
| `template_name` → `template_name` | `varchar(100)` | Evet |  |
| `plugin` → `plugin` | `varchar(100)` | Evet |  |
| `output` → `output` | `varchar(100)` | Evet |  |
| `errors` → `errors` | `jsonb` | Evet |  |

**İlişkiler**

- `user_id` → `User.id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `user_id`.
- SQL CHECK: `"total" >= 0`.
- SQL CHECK: `"progress" >= 0`.

## EmailMessage

Tablo: `common_emailmessage`. Model for storing email messages sent or received by the system.

Kaynak: `src/backend/InvenTree/common/models.py:3617`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `global_id` → `global_id` | `uuid` | Hayır | PK; Django: uuid.uuid4 |
| `message_id_key` → `message_id_key` | `varchar(250)` | Evet |  |
| `thread_id_key` → `thread_id_key` | `varchar(250)` | Evet |  |
| `thread_id` → `thread_id` | `uuid` | Evet |  |
| `subject` → `subject` | `varchar(250)` | Hayır |  |
| `body` → `body` | `text` | Hayır |  |
| `to` → `to` | `varchar(254)` | Hayır |  |
| `sender` → `sender` | `varchar(254)` | Hayır |  |
| `status` → `status` | `varchar(50)` | Evet |  |
| `timestamp` → `timestamp` | `timestamptz(6)` | Hayır | Uygulama oluşturma zamanı |
| `headers` → `headers` | `jsonb` | Evet |  |
| `full_message` → `full_message` | `text` | Evet |  |
| `direction` → `direction` | `varchar(50)` | Evet |  |
| `priority` → `priority` | `integer` | Hayır |  |
| `delivery_options` → `delivery_options` | `jsonb` | Evet |  |
| `error_code` → `error_code` | `varchar(50)` | Evet |  |
| `error_message` → `error_message` | `text` | Evet |  |
| `error_timestamp` → `error_timestamp` | `timestamptz(6)` | Evet |  |

**İlişkiler**

- `thread_id` → `EmailThread.global_id`; N:1; SQL onDelete `NoAction`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `thread_id`.

## EmailThread

Tablo: `common_emailthread`. Model for storing email threads.

Kaynak: `src/backend/InvenTree/common/models.py:3766`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `global_id` → `global_id` | `uuid` | Hayır | PK; Django: uuid.uuid4 |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `key` → `key` | `varchar(250)` | Evet |  |
| `started_internal` → `started_internal` | `boolean` | Hayır | Django: False |
| `created` → `created` | `timestamptz(6)` | Hayır | Uygulama oluşturma zamanı |
| `updated` → `updated` | `timestamptz(6)` | Hayır | Uygulama güncelleme zamanı |

**Kısıtlar ve indeksler**

- UNIQUE: `key, global_id`.

