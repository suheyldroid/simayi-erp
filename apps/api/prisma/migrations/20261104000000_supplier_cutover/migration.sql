-- Supplier cutover. This file is a forward migration. It does not record that
-- it was applied. Apply it in a maintenance window after a backup, with writers
-- stopped. The script is one explicit transaction; a later failure rolls the
-- whole scope back.
--
-- Data preservation: no table is dropped, renamed or truncated.
-- company, contact, address, manufacturer_part, supplier_part and
-- supplier_price_break stay physically in the public schema with all rows.
-- They are mapped as @@ignore archival models in prisma/schema.prisma, so the
-- generated Prisma client has no delegate for them and no route reads or
-- writes them. Foreign keys that point at these tables stay in place.
--
-- Only companies with is_supplier = true are copied into the new supplier
-- table, keeping their company id so purchase_order.supplier_id and
-- stock_item.supplier_id can be reused without renumbering. Customer-only and
-- manufacturer-only companies are not reclassified: they remain archived in
-- company, and the migration aborts rather than inventing supplier rows for
-- them. The guard below also rejects cross-tenant references instead of
-- leaking rows between organizations.
--
-- The primary supplier address is chosen deterministically: primary address
-- first, then lowest id. Its address fields are flattened onto supplier and
-- its link becomes supplier.address_link. Other addresses stay in address.
-- Contact name uses the nonblank company.contact value. Phone and role are
-- copied only from a child contact whose trimmed, case-insensitively matched
-- name equals that value; if no child matches, those fields stay empty. When
-- company.contact is blank, the first contact by id supplies name, phone and
-- role coherently. contact.phone is VARCHAR(100), wider than company.phone
-- VARCHAR(50), so it is never truncated. Other contacts stay in contact.
--
-- Purchase order lines switch from supplier_part to the catalog part (Item).
-- part_id is renamed to supplier_part_id and kept for history; item_id is
-- backfilled from supplier_part.part_id inside the same organization.
-- pack_quantity_native is snapshotted per line (nullable, default 1 for new
-- lines) so receipt conversion is preserved exactly, including historical
-- NULL pack quantities, without rewriting purchase quantities, received
-- quantities, prices or totals. Non-positive historical pack quantities abort
-- rather than silently becoming 1.
--
-- stock_item.supplier_id is backfilled from the historical supplier_part's
-- supplier. stock_item.supplier_part_id and stock_item.customer_id stay as
-- archived columns for physical history.

BEGIN;

LOCK TABLE
  "company",
  "contact",
  "address",
  "manufacturer_part",
  "supplier_part",
  "supplier_price_break",
  "purchase_order",
  "purchase_order_line_item",
  "purchase_order_extra_line",
  "stock_item"
IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  offender record;
BEGIN
  SELECT
    po.id AS order_id,
    po.organization_id AS order_organization_id,
    po.supplier_id AS supplier_id,
    c.organization_id AS company_organization_id,
    c.is_supplier AS company_is_supplier
  INTO offender
  FROM "purchase_order" AS po
  LEFT JOIN "company" AS c ON c.id = po.supplier_id
  WHERE po.supplier_id IS NOT NULL
    AND (
      c.id IS NULL
      OR c.organization_id <> po.organization_id
      OR c.is_supplier IS NOT TRUE
    )
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION
      'purchase_order % references supplier % that is missing, cross-tenant, or not marked is_supplier (order organization %, company organization %, is_supplier %)',
      offender.order_id,
      offender.supplier_id,
      offender.order_organization_id,
      offender.company_organization_id,
      offender.company_is_supplier;
  END IF;

  SELECT
    sp.id AS supplier_part_id,
    sp.organization_id AS supplier_part_organization_id,
    sp.supplier_id AS supplier_id,
    c.organization_id AS company_organization_id,
    c.is_supplier AS company_is_supplier
  INTO offender
  FROM "supplier_part" AS sp
  LEFT JOIN "company" AS c ON c.id = sp.supplier_id
  WHERE c.id IS NULL
    OR c.organization_id <> sp.organization_id
    OR c.is_supplier IS NOT TRUE
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION
      'supplier_part % references supplier % that is missing, cross-tenant, or not marked is_supplier (supplier part organization %, company organization %, is_supplier %)',
      offender.supplier_part_id,
      offender.supplier_id,
      offender.supplier_part_organization_id,
      offender.company_organization_id,
      offender.company_is_supplier;
  END IF;

  SELECT
    l.id AS line_id,
    l.organization_id AS line_organization_id,
    l.part_id AS supplier_part_id,
    sp.organization_id AS supplier_part_organization_id
  INTO offender
  FROM "purchase_order_line_item" AS l
  JOIN "supplier_part" AS sp ON sp.id = l.part_id
  WHERE l.part_id IS NOT NULL
    AND sp.organization_id <> l.organization_id
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION
      'purchase_order_line_item % references supplier_part % from another organization (line organization %, supplier part organization %)',
      offender.line_id,
      offender.supplier_part_id,
      offender.line_organization_id,
      offender.supplier_part_organization_id;
  END IF;

  SELECT
    l.id AS line_id,
    sp.id AS supplier_part_id,
    sp.pack_quantity_native AS pack_quantity_native
  INTO offender
  FROM "purchase_order_line_item" AS l
  JOIN "supplier_part" AS sp ON sp.id = l.part_id
  WHERE l.part_id IS NOT NULL
    AND sp.pack_quantity_native IS NOT NULL
    AND sp.pack_quantity_native <= 0
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION
      'purchase_order_line_item % references supplier_part % with non-positive pack quantity %; correct it before cutover',
      offender.line_id,
      offender.supplier_part_id,
      offender.pack_quantity_native;
  END IF;

  SELECT
    si.id AS stock_item_id,
    si.organization_id AS stock_item_organization_id,
    si.supplier_part_id AS supplier_part_id,
    sp.organization_id AS supplier_part_organization_id
  INTO offender
  FROM "stock_item" AS si
  JOIN "supplier_part" AS sp ON sp.id = si.supplier_part_id
  WHERE si.supplier_part_id IS NOT NULL
    AND sp.organization_id <> si.organization_id
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION
      'stock_item % references supplier_part % from another organization (stock item organization %, supplier part organization %)',
      offender.stock_item_id,
      offender.supplier_part_id,
      offender.stock_item_organization_id,
      offender.supplier_part_organization_id;
  END IF;
END $$;

CREATE TABLE "supplier" (
  "id" SERIAL NOT NULL,
  "organization_id" TEXT NOT NULL,
  "metadata" JSONB,
  "image" VARCHAR(100),
  "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(500) NOT NULL DEFAULT '',
  "website" VARCHAR(2000) NOT NULL DEFAULT '',
  "phone" VARCHAR(50) NOT NULL DEFAULT '',
  "contact" VARCHAR(100) NOT NULL DEFAULT '',
  "contact_phone" VARCHAR(100) NOT NULL DEFAULT '',
  "contact_role" VARCHAR(100) NOT NULL DEFAULT '',
  "link" VARCHAR(2000) NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "tax_id" VARCHAR(50) NOT NULL DEFAULT '',
  "line1" VARCHAR(50) NOT NULL DEFAULT '',
  "line2" VARCHAR(50) NOT NULL DEFAULT '',
  "postal_code" VARCHAR(10) NOT NULL DEFAULT '',
  "postal_city" VARCHAR(50) NOT NULL DEFAULT '',
  "province" VARCHAR(50) NOT NULL DEFAULT '',
  "country" VARCHAR(50) NOT NULL DEFAULT '',
  "shipping_notes" VARCHAR(100) NOT NULL DEFAULT '',
  "internal_shipping_notes" VARCHAR(100) NOT NULL DEFAULT '',
  "address_link" VARCHAR(2000) NOT NULL DEFAULT '',
  CONSTRAINT "supplier_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_metadata_object_check" CHECK ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object'),
  CONSTRAINT "supplier_name_nonempty_check" CHECK (length(btrim("name")) > 0)
);

CREATE UNIQUE INDEX "supplier_organization_id_id_key" ON "supplier"("organization_id", "id");

ALTER TABLE "supplier" ADD CONSTRAINT "supplier_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

INSERT INTO "supplier" (
  "id",
  "organization_id",
  "metadata",
  "image",
  "name",
  "description",
  "website",
  "phone",
  "contact",
  "contact_phone",
  "contact_role",
  "link",
  "active",
  "tax_id",
  "line1",
  "line2",
  "postal_code",
  "postal_city",
  "province",
  "country",
  "shipping_notes",
  "internal_shipping_notes",
  "address_link"
)
SELECT
  c.id,
  c.organization_id,
  c.metadata,
  c.image,
  c.name,
  c.description,
  c.website,
  c.phone,
  COALESCE(NULLIF(btrim(c.contact), ''), first_contact.name, ''),
  COALESCE(matched_contact.phone, first_contact.phone, ''),
  COALESCE(matched_contact.role, first_contact.role, ''),
  c.link,
  c.active,
  c.tax_id,
  COALESCE(primary_address.line1, ''),
  COALESCE(primary_address.line2, ''),
  COALESCE(primary_address.postal_code, ''),
  COALESCE(primary_address.postal_city, ''),
  COALESCE(primary_address.province, ''),
  COALESCE(primary_address.country, ''),
  COALESCE(primary_address.shipping_notes, ''),
  COALESCE(primary_address.internal_shipping_notes, ''),
  COALESCE(primary_address.link, '')
FROM "company" AS c
LEFT JOIN LATERAL (
  SELECT ct.phone, ct.role
  FROM "contact" AS ct
  WHERE ct.organization_id = c.organization_id
    AND ct.company_id = c.id
    AND NULLIF(btrim(c.contact), '') IS NOT NULL
    AND lower(btrim(ct.name)) = lower(btrim(c.contact))
  ORDER BY ct.id
  LIMIT 1
) AS matched_contact ON true
LEFT JOIN LATERAL (
  SELECT ct.name, ct.phone, ct.role
  FROM "contact" AS ct
  WHERE ct.organization_id = c.organization_id
    AND ct.company_id = c.id
    AND NULLIF(btrim(c.contact), '') IS NULL
  ORDER BY ct.id
  LIMIT 1
) AS first_contact ON true
LEFT JOIN LATERAL (
  SELECT
    a.line1,
    a.line2,
    a.postal_code,
    a.postal_city,
    a.province,
    a.country,
    a.shipping_notes,
    a.internal_shipping_notes,
    a.link
  FROM "address" AS a
  WHERE a.organization_id = c.organization_id
    AND a.company_id = c.id
  ORDER BY a."primary" DESC, a.id
  LIMIT 1
) AS primary_address ON true
WHERE c.is_supplier;

SELECT setval(
  pg_get_serial_sequence('supplier', 'id'),
  COALESCE((SELECT MAX(id) FROM "supplier"), 0) + 1,
  false
);

ALTER TABLE "purchase_order"
  DROP CONSTRAINT "purchase_order_supplier_id_fkey";
ALTER TABLE "purchase_order"
  DROP CONSTRAINT "purchase_order_supplier_id_same_org_fkey";
ALTER TABLE "purchase_order"
  ADD CONSTRAINT "purchase_order_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "purchase_order"
  ADD CONSTRAINT "purchase_order_supplier_id_same_org_fkey"
  FOREIGN KEY ("organization_id", "supplier_id")
  REFERENCES "supplier"("organization_id", "id")
  ON DELETE NO ACTION ON UPDATE NO ACTION
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "purchase_order_line_item"
  RENAME COLUMN "part_id" TO "supplier_part_id";
ALTER TABLE "purchase_order_line_item"
  RENAME CONSTRAINT "purchase_order_line_item_part_id_fkey"
  TO "purchase_order_line_item_supplier_part_id_fkey";
ALTER TABLE "purchase_order_line_item"
  RENAME CONSTRAINT "purchase_order_line_item_part_id_same_org_fkey"
  TO "purchase_order_line_item_supplier_part_id_same_org_fkey";
ALTER INDEX "purchase_order_line_item_part_id_idx"
  RENAME TO "purchase_order_line_item_supplier_part_id_idx";

ALTER TABLE "purchase_order_line_item" ADD COLUMN "item_id" INTEGER;
ALTER TABLE "purchase_order_line_item"
  ADD COLUMN "pack_quantity_native" DECIMAL(20, 10) DEFAULT 1;

UPDATE "purchase_order_line_item" AS l
SET
  "item_id" = sp."part_id",
  "pack_quantity_native" = sp."pack_quantity_native"
FROM "supplier_part" AS sp
WHERE sp.id = l."supplier_part_id"
  AND sp.organization_id = l.organization_id;

CREATE INDEX "purchase_order_line_item_item_id_idx"
  ON "purchase_order_line_item"("item_id");
ALTER TABLE "purchase_order_line_item"
  ADD CONSTRAINT "purchase_order_line_item_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "part"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "purchase_order_line_item"
  ADD CONSTRAINT "purchase_order_line_item_item_id_same_org_fkey"
  FOREIGN KEY ("organization_id", "item_id")
  REFERENCES "part"("organization_id", "id")
  ON DELETE NO ACTION ON UPDATE NO ACTION
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "stock_item" ADD COLUMN "supplier_id" INTEGER;

UPDATE "stock_item" AS si
SET "supplier_id" = sp."supplier_id"
FROM "supplier_part" AS sp
WHERE sp.id = si."supplier_part_id"
  AND sp.organization_id = si.organization_id;

CREATE INDEX "stock_item_supplier_id_idx" ON "stock_item"("supplier_id");
ALTER TABLE "stock_item"
  ADD CONSTRAINT "stock_item_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "stock_item"
  ADD CONSTRAINT "stock_item_supplier_id_same_org_fkey"
  FOREIGN KEY ("organization_id", "supplier_id")
  REFERENCES "supplier"("organization_id", "id")
  ON DELETE NO ACTION ON UPDATE NO ACTION
  DEFERRABLE INITIALLY DEFERRED;

COMMIT;
