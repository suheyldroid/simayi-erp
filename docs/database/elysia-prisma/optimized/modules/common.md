# Ortak işlevler ve ayarlar

Varyant: **optimized**. Kaynak commit: `66de7b77d4b62c9bdfa6bfa867de16f1aac22f32`.

Prisma: [modül şeması](../prisma/common.prisma).

İlişki alanlarının tabloda saklanan karşılığı `…Id` / `…_id` sütunudur. `?`, SQL NULL anlamına gelir. Django `blank=True`, NULL anlamına gelmez.

## ProjectCode

Tablo: `project_code`. A ProjectCode is a unique identifier for a project.

Kaynak: `src/backend/InvenTree/common/models.py:154`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `code` → `code` | `varchar(50)` | Hayır | UNIQUE |
| `description` → `description` | `varchar(200)` | Hayır | Prisma: "" |
| `active` → `active` | `boolean` | Hayır | Prisma: true; Django: True |
| `responsibleId` → `responsible_id` | `integer` | Evet |  |

**İlişkiler**

- `responsibleId` → `Owner.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `responsibleId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

## SystemSetting

Tablo: `system_setting`. An InvenTreeSetting object is a key:value pair used for storing single values (e.g. one-off settings values).

Kaynak: `src/backend/InvenTree/common/models.py:1239`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `key` → `key` | `varchar(50)` | Hayır | UNIQUE |
| `value` → `value` | `varchar(2000)` | Hayır | Prisma: "" |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## UserSetting

Tablo: `user_setting`. An InvenTreeSetting object with a user context.

Kaynak: `src/backend/InvenTree/common/models.py:1334`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `key` → `key` | `varchar(50)` | Hayır |  |
| `value` → `value` | `varchar(2000)` | Hayır | Prisma: "" |
| `userId` → `user_id` | `uuid` | Evet |  |

**İlişkiler**

- `userId` → `User.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `key, userId`.
- INDEX: `userId`.

## WebhookEndpoint

Tablo: `webhook_endpoint`. Defines a Webhook endpoint.

Kaynak: `src/backend/InvenTree/common/models.py:1431`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `endpointId` → `endpoint_id` | `varchar(255)` | Hayır | Prisma: dbgenerated("gen_random_uuid()"); Django: uuid.uuid4 |
| `name` → `name` | `varchar(255)` | Evet |  |
| `active` → `active` | `boolean` | Hayır | Prisma: true; Django: True |
| `userId` → `user_id` | `uuid` | Evet |  |
| `token` → `token` | `varchar(255)` | Evet | Prisma: dbgenerated("gen_random_uuid()"); Django: uuid.uuid4 |
| `secret` → `secret` | `varchar(255)` | Evet |  |

**İlişkiler**

- `userId` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `userId`.

## WebhookMessage

Tablo: `webhook_message`. Defines a webhook message.

Kaynak: `src/backend/InvenTree/common/models.py:1588`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `uuid` | Hayır | PK; Prisma: dbgenerated("gen_random_uuid()"); Django: uuid.uuid4 |
| `host` → `host` | `varchar(255)` | Hayır |  |
| `header` → `header` | `varchar(255)` | Evet |  |
| `body` → `body` | `jsonb` | Evet |  |
| `endpointId` → `endpoint_id` | `integer` | Evet |  |
| `workedOn` → `worked_on` | `boolean` | Hayır | Prisma: false; Django: False |

**İlişkiler**

- `endpointId` → `WebhookEndpoint.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `endpointId, workedOn`.

## NotificationEntry

Tablo: `notification_entry`. A NotificationEntry records the last time a particular notification was sent out.

Kaynak: `src/backend/InvenTree/common/models.py:1648`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `updated` → `updated` | `timestamptz(6)` | Evet | Prisma: now(); Uygulama güncelleme zamanı |
| `key` → `key` | `varchar(250)` | Hayır |  |
| `uid` → `uid` | `varchar(255)` | Hayır |  |

**Kısıtlar ve indeksler**

- UNIQUE: `key, uid`.

## NotificationMessage

Tablo: `notification_message`. A NotificationMessage is a message sent to a particular user, notifying them of some important information.

Kaynak: `src/backend/InvenTree/common/models.py:1687`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `targetContentTypeId` → `target_content_type_id` | `integer` | Hayır |  |
| `targetObjectId` → `target_object_id` | `varchar(255)` | Hayır |  |
| `sourceContentTypeId` → `source_content_type_id` | `integer` | Evet |  |
| `sourceObjectId` → `source_object_id` | `varchar(255)` | Evet |  |
| `userId` → `user_id` | `uuid` | Evet |  |
| `category` → `category` | `varchar(250)` | Hayır |  |
| `name` → `name` | `varchar(250)` | Hayır |  |
| `message` → `message` | `varchar(250)` | Evet |  |
| `link` → `link` | `varchar(500)` | Evet |  |
| `creation` → `creation` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama oluşturma zamanı |
| `read` → `read` | `boolean` | Hayır | Prisma: false; Django: False |

**İlişkiler**

- `targetContentTypeId` → `ModelType.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `sourceContentTypeId` → `ModelType.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `userId` → `User.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `userId, read, creation`.
- INDEX: `sourceContentTypeId`.
- INDEX: `targetContentTypeId`.

**Sütun olmayan Django alanları**

- `target_object`: `GenericForeignKey`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.
- `source_object`: `GenericForeignKey`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## NewsFeedEntry

Tablo: `news_feed_entry`. A NewsFeedEntry represents an entry on the RSS/Atom feed that is generated for InvenTree news.

Kaynak: `src/backend/InvenTree/common/models.py:1766`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `feedId` → `feed_id` | `varchar(250)` | Hayır | UNIQUE |
| `title` → `title` | `varchar(250)` | Hayır |  |
| `link` → `link` | `varchar(250)` | Hayır |  |
| `published` → `published` | `timestamptz(6)` | Hayır |  |
| `author` → `author` | `varchar(250)` | Hayır |  |
| `summary` → `summary` | `varchar(250)` | Hayır |  |
| `read` → `read` | `boolean` | Hayır | Prisma: false; Django: False |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## CustomUnit

Tablo: `custom_unit`. Model for storing custom physical unit definitions.

Kaynak: `src/backend/InvenTree/common/models.py:1796`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `name` → `name` | `varchar(50)` | Hayır | UNIQUE |
| `symbol` → `symbol` | `varchar(10)` | Hayır | Prisma: "" |
| `definition` → `definition` | `varchar(50)` | Hayır |  |

**Kısıtlar ve indeksler**

- PK ve alan üzerindeki UNIQUE dışında ek kısıt yok.

## Attachment

Tablo: `attachment`. Class which represents an uploaded file attachment.

Kaynak: `src/backend/InvenTree/common/models.py:1936`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `modelType` → `model_type` | `varchar(100)` | Hayır |  |
| `modelId` → `model_id` | `integer` | Hayır |  |
| `attachment` → `attachment` | `varchar(100)` | Evet |  |
| `thumbnail` → `thumbnail` | `varchar(100)` | Evet |  |
| `link` → `link` | `varchar(2000)` | Evet |  |
| `comment` → `comment` | `varchar(250)` | Hayır | Prisma: "" |
| `uploadUserId` → `upload_user_id` | `uuid` | Evet |  |
| `uploadDate` → `upload_date` | `date` | Evet | Prisma: now(); Uygulama oluşturma zamanı |
| `isImage` → `is_image` | `boolean` | Hayır | Prisma: false; Django: False |
| `fileSize` → `file_size` | `integer` | Hayır | Prisma: 0; Django: 0 |

**İlişkiler**

- `uploadUserId` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `modelType, modelId`.
- INDEX: `uploadUserId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"model_id" >= 0`.
- SQL CHECK: `"file_size" >= 0`.

**Sütun olmayan Django alanları**

- `tags`: `TaggableManager`. `Tag` / `TaggedItem` tablolarıyla bağlantılıdır.

## CustomStatus

Tablo: `custom_status`. Custom model to extends any registered state with extra custom, user defined states.

Kaynak: `src/backend/InvenTree/common/models.py:2277`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `referenceStatus` → `reference_status` | `varchar(250)` | Hayır |  |
| `logicalKey` → `logical_key` | `integer` | Hayır |  |
| `key` → `key` | `integer` | Hayır |  |
| `name` → `name` | `varchar(250)` | Hayır |  |
| `label` → `label` | `varchar(250)` | Hayır |  |
| `color` → `color` | `varchar(10)` | Hayır | Prisma: "secondary"; Django: ColorEnum.secondary.value |
| `modelId` → `model_id` | `integer` | Evet |  |

**İlişkiler**

- `modelId` → `ModelType.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- UNIQUE: `referenceStatus, key`.
- UNIQUE: `referenceStatus, name`.
- INDEX: `modelId`.

## SelectionList

Tablo: `selection_list`. Class which represents a list of selectable items for parameters.

Kaynak: `src/backend/InvenTree/common/models.py:2417`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `name` → `name` | `varchar(100)` | Hayır | UNIQUE |
| `description` → `description` | `varchar(250)` | Hayır | Prisma: "" |
| `locked` → `locked` | `boolean` | Hayır | Prisma: false; Django: False |
| `active` → `active` | `boolean` | Hayır | Prisma: true; Django: True |
| `sourcePluginId` → `source_plugin_id` | `integer` | Evet |  |
| `sourceString` → `source_string` | `varchar(1000)` | Hayır | Prisma: "" |
| `defaultId` → `default_id` | `integer` | Evet |  |
| `created` → `created` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama oluşturma zamanı |
| `lastUpdated` → `last_updated` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama güncelleme zamanı |

**İlişkiler**

- `sourcePluginId` → `PluginConfig.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `defaultId` → `SelectionListEntry.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `sourcePluginId`.
- INDEX: `defaultId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

## SelectionListEntry

Tablo: `selection_list_entry`. Class which represents a single entry in a SelectionList.

Kaynak: `src/backend/InvenTree/common/models.py:2548`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `listId` → `list_id` | `integer` | Evet |  |
| `value` → `value` | `varchar(255)` | Hayır |  |
| `label` → `label` | `varchar(255)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır | Prisma: "" |
| `active` → `active` | `boolean` | Hayır | Prisma: true; Django: True |

**İlişkiler**

- `listId` → `SelectionList.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `listId, value`.

## ParameterTemplate

Tablo: `parameter_template`. A ParameterTemplate provides a template for defining parameter values against various models.

Kaynak: `src/backend/InvenTree/common/models.py:2608`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `modelTypeId` → `model_type_id` | `integer` | Evet |  |
| `name` → `name` | `varchar(100)` | Hayır | UNIQUE |
| `units` → `units` | `varchar(25)` | Hayır | Prisma: "" |
| `description` → `description` | `varchar(250)` | Hayır | Prisma: "" |
| `checkbox` → `checkbox` | `boolean` | Hayır | Prisma: false; Django: False |
| `choices` → `choices` | `varchar(5000)` | Hayır | Prisma: "" |
| `selectionlistId` → `selectionlist_id` | `integer` | Evet |  |
| `enabled` → `enabled` | `boolean` | Hayır | Prisma: true; Django: True |
| `unique` → `unique` | `integer` | Hayır | Prisma: 0; Django: UniqueOptions.NONE |

**İlişkiler**

- `modelTypeId` → `ModelType.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `selectionlistId` → `SelectionList.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `selectionlistId`.
- INDEX: `modelTypeId`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"unique" >= 0`.

## Parameter

Tablo: `parameter`. Class which represents a parameter value assigned to a particular model instance.

Kaynak: `src/backend/InvenTree/common/models.py:2829`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `updated` → `updated` | `timestamptz(6)` | Evet | Django: None |
| `updatedById` → `updated_by_id` | `uuid` | Evet |  |
| `modelTypeId` → `model_type_id` | `integer` | Hayır |  |
| `modelId` → `model_id` | `integer` | Hayır |  |
| `templateId` → `template_id` | `integer` | Hayır |  |
| `data` → `data` | `varchar(500)` | Hayır |  |
| `dataNumeric` → `data_numeric` | `double precision` | Evet | Django: None |
| `note` → `note` | `varchar(500)` | Hayır | Prisma: "" |

**İlişkiler**

- `updatedById` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `modelTypeId` → `ModelType.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.
- `templateId` → `ParameterTemplate.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- UNIQUE: `modelTypeId, modelId, templateId`.
- INDEX: `templateId`.
- INDEX: `updatedById`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"model_id" >= 0`.

**Sütun olmayan Django alanları**

- `content_object`: `GenericForeignKey`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## Note

Tablo: `note`. Class which represents a note assigned to a particular model instance.

Kaynak: `src/backend/InvenTree/common/models.py:3086`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `updated` → `updated` | `timestamptz(6)` | Evet | Django: None |
| `updatedById` → `updated_by_id` | `uuid` | Evet |  |
| `template` → `template` | `boolean` | Hayır | Prisma: false; Django: False |
| `modelTypeId` → `model_type_id` | `integer` | Evet |  |
| `modelId` → `model_id` | `integer` | Evet |  |
| `primary` → `primary` | `boolean` | Hayır | Prisma: false; Django: False |
| `title` → `title` | `varchar(100)` | Hayır |  |
| `description` → `description` | `varchar(250)` | Hayır | Prisma: "" |
| `content` → `content` | `text` | Hayır | Prisma: "" |

**İlişkiler**

- `updatedById` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `modelTypeId` → `ModelType.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `modelTypeId, modelId`.
- INDEX: `updatedById`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.
- SQL CHECK: `"model_id" >= 0`.
- Koşullu benzersizlik `constraints.sql` dosyasında; Prisma şemasının tek başına uygulanması yeterli değildir.

**Sütun olmayan Django alanları**

- `content_object`: `GenericForeignKey`. Genel nesne bağlantısıdır; hedef kayda doğrudan PostgreSQL FK oluşturmaz.

## NotesImage

Tablo: `notes_image`. Model for storing uploading images for the 'notes' fields of various models.

Kaynak: `src/backend/InvenTree/common/models.py:3399`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `image` → `image` | `varchar(100)` | Hayır |  |
| `userId` → `user_id` | `uuid` | Evet |  |
| `date` → `date` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama oluşturma zamanı |
| `noteId` → `note_id` | `integer` | Hayır |  |

**İlişkiler**

- `userId` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.
- `noteId` → `Note.id`; N:1; SQL onDelete `Cascade`; kaynak Django `CASCADE`.

**Kısıtlar ve indeksler**

- INDEX: `userId`.
- INDEX: `noteId`.

## BarcodeScanResult

Tablo: `barcode_scan_result`. Model for storing barcode scans results.

Kaynak: `src/backend/InvenTree/common/models.py:3433`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `data` → `data` | `varchar(250)` | Hayır |  |
| `userId` → `user_id` | `uuid` | Evet |  |
| `timestamp` → `timestamp` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama oluşturma zamanı |
| `endpoint` → `endpoint` | `varchar(250)` | Evet |  |
| `context` → `context` | `jsonb` | Evet |  |
| `response` → `response` | `jsonb` | Evet |  |
| `result` → `result` | `boolean` | Hayır | Prisma: false; Django: False |

**İlişkiler**

- `userId` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `userId`.

## DataOutput

Tablo: `data_output`. Model for storing generated data output from various processes.

Kaynak: `src/backend/InvenTree/common/models.py:3497`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `integer` | Hayır | PK; Prisma: autoincrement(); DEFAULT_AUTO_FIELD = django.db.models.AutoField |
| `created` → `created` | `date` | Hayır | Prisma: now(); Uygulama oluşturma zamanı |
| `userId` → `user_id` | `uuid` | Evet |  |
| `total` → `total` | `integer` | Hayır | Prisma: 1; Django: 1 |
| `progress` → `progress` | `integer` | Hayır | Prisma: 0; Django: 0 |
| `complete` → `complete` | `boolean` | Hayır | Prisma: false; Django: False |
| `outputType` → `output_type` | `varchar(100)` | Evet |  |
| `templateName` → `template_name` | `varchar(100)` | Evet |  |
| `plugin` → `plugin` | `varchar(100)` | Evet |  |
| `output` → `output` | `varchar(100)` | Evet |  |
| `errors` → `errors` | `jsonb` | Evet |  |

**İlişkiler**

- `userId` → `User.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `userId`.
- SQL CHECK: `"total" >= 0`.
- SQL CHECK: `"progress" >= 0`.

## EmailMessage

Tablo: `email_message`. Model for storing email messages sent or received by the system.

Kaynak: `src/backend/InvenTree/common/models.py:3617`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `uuid` | Hayır | PK; Prisma: dbgenerated("gen_random_uuid()"); Django: uuid.uuid4 |
| `messageIdKey` → `message_id_key` | `varchar(250)` | Evet |  |
| `threadIdKey` → `thread_id_key` | `varchar(250)` | Evet |  |
| `threadId` → `thread_id` | `uuid` | Evet |  |
| `subject` → `subject` | `varchar(250)` | Hayır |  |
| `body` → `body` | `text` | Hayır |  |
| `to` → `to` | `varchar(254)` | Hayır |  |
| `sender` → `sender` | `varchar(254)` | Hayır |  |
| `status` → `status` | `varchar(50)` | Evet |  |
| `timestamp` → `timestamp` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama oluşturma zamanı |
| `headers` → `headers` | `jsonb` | Evet |  |
| `fullMessage` → `full_message` | `text` | Evet |  |
| `direction` → `direction` | `varchar(50)` | Evet |  |
| `priority` → `priority` | `integer` | Hayır |  |
| `deliveryOptions` → `delivery_options` | `jsonb` | Evet |  |
| `errorCode` → `error_code` | `varchar(50)` | Evet |  |
| `errorMessage` → `error_message` | `text` | Evet |  |
| `errorTimestamp` → `error_timestamp` | `timestamptz(6)` | Evet |  |

**İlişkiler**

- `threadId` → `EmailThread.id`; N:1; SQL onDelete `SetNull`; kaynak Django `SET_NULL`.

**Kısıtlar ve indeksler**

- INDEX: `threadId, timestamp`.

## EmailThread

Tablo: `email_thread`. Model for storing email threads.

Kaynak: `src/backend/InvenTree/common/models.py:3766`.

| Alan | PostgreSQL | NULL | Varsayılan / not |
|---|---|---|---|
| `id` → `id` | `uuid` | Hayır | PK; Prisma: dbgenerated("gen_random_uuid()"); Django: uuid.uuid4 |
| `metadata` → `metadata` | `jsonb` | Evet |  |
| `key` → `key` | `varchar(250)` | Evet |  |
| `startedInternal` → `started_internal` | `boolean` | Hayır | Prisma: false; Django: False |
| `created` → `created` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama oluşturma zamanı |
| `updated` → `updated` | `timestamptz(6)` | Hayır | Prisma: now(); Uygulama güncelleme zamanı |

**Kısıtlar ve indeksler**

- UNIQUE: `key, id`.
- SQL CHECK: `"metadata" IS NULL OR jsonb_typeof("metadata") = 'object'`.

