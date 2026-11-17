-- CreateTable
CREATE TABLE "tag" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tag_name_key" ON "tag"("name");
CREATE UNIQUE INDEX "tag_slug_key" ON "tag"("slug");
CREATE UNIQUE INDEX "tag_name_lower_key" ON "tag" (lower("name"));
CREATE UNIQUE INDEX "tag_slug_lower_key" ON "tag" (lower("slug"));

CREATE TABLE "tagged_item" (
    "id" SERIAL NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "content_type_id" INTEGER NOT NULL,
    "object_id" INTEGER NOT NULL,
    CONSTRAINT "tagged_item_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tagged_item_content_type_id_object_id_tag_id_key" ON "tagged_item"("content_type_id", "object_id", "tag_id");
CREATE INDEX "tagged_item_tag_id_idx" ON "tagged_item"("tag_id");
CREATE INDEX "tagged_item_object_id_idx" ON "tagged_item"("object_id");

CREATE TABLE "selection_list" (
    "id" SERIAL NOT NULL,
    "metadata" JSONB,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(250) NOT NULL DEFAULT '',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source_string" VARCHAR(1000) NOT NULL DEFAULT '',
    "default_id" INTEGER,
    "created" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "selection_list_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "selection_list_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object')
);
CREATE UNIQUE INDEX "selection_list_name_key" ON "selection_list"("name");
CREATE INDEX "selection_list_default_id_idx" ON "selection_list"("default_id");

CREATE TABLE "selection_list_entry" (
    "id" SERIAL NOT NULL,
    "list_id" INTEGER,
    "value" VARCHAR(255) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "description" VARCHAR(250) NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "selection_list_entry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "selection_list_entry_list_id_value_key" ON "selection_list_entry"("list_id", "value");

ALTER TABLE "parameter_template" ADD COLUMN "selectionlist_id" INTEGER;
CREATE INDEX "parameter_template_selectionlist_id_idx" ON "parameter_template"("selectionlist_id");

CREATE TABLE "note" (
    "id" SERIAL NOT NULL,
    "metadata" JSONB,
    "updated" TIMESTAMPTZ(6),
    "updated_by_id" TEXT,
    "template" BOOLEAN NOT NULL DEFAULT false,
    "model_type_id" INTEGER,
    "model_id" INTEGER,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "title" VARCHAR(100) NOT NULL,
    "description" VARCHAR(250) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "note_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "note_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
    CONSTRAINT "note_model_id_check" CHECK ("model_id" >= 0)
);
CREATE INDEX "note_model_type_id_model_id_idx" ON "note"("model_type_id", "model_id");
CREATE INDEX "note_updated_by_id_idx" ON "note"("updated_by_id");
CREATE UNIQUE INDEX "unique_primary_note_per_model" ON "note" ("model_type_id", "model_id") WHERE "primary" = TRUE AND "template" = FALSE;

CREATE TABLE "notes_image" (
    "id" SERIAL NOT NULL,
    "image" VARCHAR(100) NOT NULL,
    "user_id" TEXT,
    "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note_id" INTEGER NOT NULL,
    CONSTRAINT "notes_image_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notes_image_user_id_idx" ON "notes_image"("user_id");
CREATE INDEX "notes_image_note_id_idx" ON "notes_image"("note_id");

CREATE TABLE "attachment" (
    "id" SERIAL NOT NULL,
    "metadata" JSONB,
    "model_type" VARCHAR(100) NOT NULL,
    "model_id" INTEGER NOT NULL,
    "attachment" VARCHAR(100),
    "thumbnail" VARCHAR(100),
    "link" VARCHAR(2000),
    "comment" VARCHAR(250) NOT NULL DEFAULT '',
    "upload_user_id" TEXT,
    "upload_date" DATE DEFAULT CURRENT_TIMESTAMP,
    "is_image" BOOLEAN NOT NULL DEFAULT false,
    "file_size" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attachment_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
    CONSTRAINT "attachment_model_id_check" CHECK ("model_id" >= 0),
    CONSTRAINT "attachment_file_size_check" CHECK ("file_size" >= 0)
);
CREATE INDEX "attachment_model_type_model_id_idx" ON "attachment"("model_type", "model_id");
CREATE INDEX "attachment_upload_user_id_idx" ON "attachment"("upload_user_id");

CREATE TABLE "notification_entry" (
    "id" SERIAL NOT NULL,
    "updated" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "key" VARCHAR(250) NOT NULL,
    "uid" VARCHAR(255) NOT NULL,
    CONSTRAINT "notification_entry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "notification_entry_key_uid_key" ON "notification_entry"("key", "uid");

CREATE TABLE "notification_message" (
    "id" SERIAL NOT NULL,
    "target_content_type_id" INTEGER NOT NULL,
    "target_object_id" VARCHAR(255) NOT NULL,
    "source_content_type_id" INTEGER,
    "source_object_id" VARCHAR(255),
    "user_id" TEXT,
    "category" VARCHAR(250) NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "message" VARCHAR(250),
    "link" VARCHAR(500),
    "creation" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "notification_message_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notification_message_user_id_read_creation_idx" ON "notification_message"("user_id", "read", "creation");
CREATE INDEX "notification_message_source_content_type_id_idx" ON "notification_message"("source_content_type_id");
CREATE INDEX "notification_message_target_content_type_id_idx" ON "notification_message"("target_content_type_id");

CREATE TABLE "webhook_endpoint" (
    "id" SERIAL NOT NULL,
    "endpoint_id" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "user_id" TEXT,
    "token" VARCHAR(255),
    "secret" VARCHAR(255),
    CONSTRAINT "webhook_endpoint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "webhook_endpoint_user_id_idx" ON "webhook_endpoint"("user_id");

CREATE TABLE "webhook_message" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "host" VARCHAR(255) NOT NULL,
    "header" VARCHAR(255),
    "body" JSONB,
    "endpoint_id" INTEGER,
    "worked_on" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "webhook_message_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "webhook_message_endpoint_id_worked_on_idx" ON "webhook_message"("endpoint_id", "worked_on");

CREATE TABLE "email_thread" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "metadata" JSONB,
    "key" VARCHAR(250),
    "started_internal" BOOLEAN NOT NULL DEFAULT false,
    "created" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_thread_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "email_thread_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object')
);
CREATE UNIQUE INDEX "email_thread_key_id_key" ON "email_thread"("key", "id");

CREATE TABLE "email_message" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id_key" VARCHAR(250),
    "thread_id_key" VARCHAR(250),
    "thread_id" UUID,
    "subject" VARCHAR(250) NOT NULL,
    "body" TEXT NOT NULL,
    "to" VARCHAR(254) NOT NULL,
    "sender" VARCHAR(254) NOT NULL,
    "status" VARCHAR(50),
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "headers" JSONB,
    "full_message" TEXT,
    "direction" VARCHAR(50),
    "priority" INTEGER NOT NULL,
    "delivery_options" JSONB,
    "error_code" VARCHAR(50),
    "error_message" TEXT,
    "error_timestamp" TIMESTAMPTZ(6),
    CONSTRAINT "email_message_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "email_message_thread_id_timestamp_idx" ON "email_message"("thread_id", "timestamp");

-- AddForeignKey
ALTER TABLE "tagged_item" ADD CONSTRAINT "tagged_item_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "tagged_item" ADD CONSTRAINT "tagged_item_content_type_id_fkey" FOREIGN KEY ("content_type_id") REFERENCES "model_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "selection_list_entry" ADD CONSTRAINT "selection_list_entry_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "selection_list"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "selection_list" ADD CONSTRAINT "selection_list_default_id_fkey" FOREIGN KEY ("default_id") REFERENCES "selection_list_entry"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "parameter_template" ADD CONSTRAINT "parameter_template_selectionlist_id_fkey" FOREIGN KEY ("selectionlist_id") REFERENCES "selection_list"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "note" ADD CONSTRAINT "note_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "note" ADD CONSTRAINT "note_model_type_id_fkey" FOREIGN KEY ("model_type_id") REFERENCES "model_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "notes_image" ADD CONSTRAINT "notes_image_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "notes_image" ADD CONSTRAINT "notes_image_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_upload_user_id_fkey" FOREIGN KEY ("upload_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "notification_message" ADD CONSTRAINT "notification_message_target_content_type_id_fkey" FOREIGN KEY ("target_content_type_id") REFERENCES "model_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "notification_message" ADD CONSTRAINT "notification_message_source_content_type_id_fkey" FOREIGN KEY ("source_content_type_id") REFERENCES "model_type"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "notification_message" ADD CONSTRAINT "notification_message_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "webhook_endpoint" ADD CONSTRAINT "webhook_endpoint_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "webhook_message" ADD CONSTRAINT "webhook_message_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoint"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "email_thread"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

INSERT INTO "model_type" ("app_label", "model")
VALUES
    ('common', 'tag'),
    ('common', 'taggeditem'),
    ('common', 'note'),
    ('common', 'notesimage'),
    ('common', 'attachment'),
    ('common', 'selectionlist'),
    ('common', 'selectionlistentry'),
    ('common', 'notificationentry'),
    ('common', 'notificationmessage'),
    ('common', 'webhookendpoint'),
    ('common', 'webhookmessage'),
    ('common', 'emailthread'),
    ('common', 'emailmessage')
ON CONFLICT ("app_label", "model") DO NOTHING;
