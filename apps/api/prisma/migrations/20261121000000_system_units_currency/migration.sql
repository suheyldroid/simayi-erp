-- Global units and global system preferences.
-- Forward migration for the state produced by 20261119000000_units and
-- 20261120000000_currencies. It does not record that it was applied and it has
-- not been executed against any database by this change. Prisma does not wrap a
-- PostgreSQL migration in a transaction, so this file is one explicit
-- BEGIN/COMMIT block.
--
-- Deployment: stop every API writer, apply this migration, then start the code
-- that reads the global `unit` catalog and `system_preference`. Every table
-- this migration reads or rewrites is locked ACCESS EXCLUSIVE for the whole
-- transaction, so no reader or writer observes a half-global catalog.
--
-- Data handling:
--   * `unit` becomes one global catalog: `organization_id` is dropped and
--     `code` is unique on its own. Rows that share a code across
--     organizations are merged only when every definition is exactly
--     equivalent: identical `name` and identical `active`. The survivor is
--     the lowest `id` (the oldest row), so its public `uuid` stays valid and
--     stable; every `part` row of a retired duplicate is re-pointed to the
--     survivor, and each retired duplicate uuid is reported with RAISE WARNING
--     before it is deleted. Capture the migration output; it is the record of
--     the retired public uuids, because the duplicate rows are removed. Because
--     a merge requires identical name, code and active, the item's observable
--     unit does not change; only the internal foreign-key value does.
--   * Any code whose definitions differ in `name` or `active` aborts the
--     whole migration with the offending codes and counts. Nothing is guessed,
--     renamed, activated or deactivated.
--   * `organization_preference` is replaced by the global singleton
--     `system_preference`. Its stored default is copied only when every stored
--     preference agrees: all NULL, or one identical code. Any mix of NULL and a
--     code, or two different codes, aborts with the stored values and
--     organization ids. With no stored row the global default stays unknown
--     (NULL); no currency is invented. A value that is no longer an active ISO
--     4217 currency (SIX list published 2026-09-17) also aborts instead of being
--     preserved invisibly or converted.
--   * No item balance, purchase-order reference/price/total/currency, tracking
--     row or sales snapshot is rewritten. `part.units` was already dropped by
--     20261119000000_units; the historical `unit_code` snapshot columns added
--     by that migration stay untouched.

BEGIN;

LOCK TABLE "unit", "part", "item_tracking", "purchase_order",
  "purchase_order_line_item", "organization_preference"
  IN ACCESS EXCLUSIVE MODE;

-- 1. Fail closed when the same code means different things in two organizations.
DO $$
DECLARE
  conflicts text;
BEGIN
  SELECT string_agg(
           format(
             'code %s (%s definitions, %s distinct names, %s distinct active values)',
             c.code, c.definitions, c.names, c.states
           ),
           '; ' ORDER BY c.code
         )
    INTO conflicts
  FROM (
    SELECT code,
           count(*) AS definitions,
           count(DISTINCT name) AS names,
           count(DISTINCT active) AS states
    FROM "unit"
    GROUP BY code
    HAVING count(DISTINCT name) > 1 OR count(DISTINCT active) > 1
  ) AS c;

  IF conflicts IS NOT NULL THEN
    RAISE EXCEPTION
      'cannot globalize units: the same code has non-equivalent definitions across organizations: %. Make name and active identical for each code, reconcile the conflicting items manually, then rerun 20261121000000_system_units_currency.',
      conflicts;
  END IF;
END $$;

-- 2. Drop the tenant-composite item/unit foreign key before the merge. A
--    survivor may belong to a different organization than the items of a
--    retired duplicate, so the old (organization_id, unit_id) reference would
--    reject the re-point in step 3. Writers are excluded by the table locks and
--    the single-column key is recreated in step 7.
ALTER TABLE "part" DROP CONSTRAINT "part_organization_id_unit_id_fkey";

-- 3. Re-point every item of a duplicate row to the deterministic survivor
--    (lowest unit id per code) before the duplicates are removed.
UPDATE "part" AS p
SET "unit_id" = survivor.survivor_id
FROM (
  SELECT u.id, min(u.id) OVER (PARTITION BY u.code) AS survivor_id
  FROM "unit" AS u
) AS survivor
WHERE p."unit_id" = survivor.id
  AND survivor.id <> survivor.survivor_id;

-- 4. Report every retired duplicate uuid before deleting it.
DO $$
DECLARE
  duplicate record;
BEGIN
  FOR duplicate IN
    SELECT u.uuid AS retired_uuid,
           u.code,
           u.name,
           u.active,
           s.uuid AS survivor_uuid
    FROM "unit" AS u
    JOIN (
      SELECT code, min(id) AS survivor_id
      FROM "unit"
      GROUP BY code
    ) AS m ON m.code = u.code
    JOIN "unit" AS s ON s.id = m.survivor_id
    WHERE u.id <> m.survivor_id
    ORDER BY u.code, u.id
  LOOP
    RAISE WARNING
      'retired duplicate unit uuid % (code %, name %, active %) merged into surviving unit uuid %',
      duplicate.retired_uuid, duplicate.code, duplicate.name,
      duplicate.active, duplicate.survivor_uuid;
  END LOOP;
END $$;

-- 5. Remove the retired duplicates; every referencing item already points at
--    the survivor.
DELETE FROM "unit" AS u
USING (
  SELECT code, min(id) AS survivor_id
  FROM "unit"
  GROUP BY code
) AS m
WHERE u.code = m.code
  AND u.id <> m.survivor_id;

-- 6. Verify no item lost its unit while the duplicates were merged.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "part" AS p
    WHERE p."unit_id" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "unit" AS u WHERE u.id = p."unit_id")
  ) THEN
    RAISE EXCEPTION
      'part.unit_id references a missing unit after merging duplicate codes; the transaction was rolled back';
  END IF;
END $$;

-- 7. Make the catalog global. The old tenant indexes are replaced by a
--    single-column reference to the global catalog.
ALTER TABLE "unit" DROP CONSTRAINT "unit_organization_id_fkey";
DROP INDEX "unit_organization_id_code_key";
DROP INDEX "unit_organization_id_id_key";
DROP INDEX "unit_organization_id_active_id_idx";
ALTER TABLE "unit" DROP COLUMN "organization_id";
CREATE UNIQUE INDEX "unit_code_key" ON "unit"("code");
CREATE INDEX "unit_active_id_idx" ON "unit"("active", "id");

ALTER TABLE "part"
  ADD CONSTRAINT "part_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "unit"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

-- 8. The global singleton preference. `key` is the stable singleton
--    discriminator and the check makes any other value impossible.
CREATE TABLE "system_preference" (
  "id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR(16) NOT NULL DEFAULT 'system',
  "default_currency_code" VARCHAR(3),

  CONSTRAINT "system_preference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "system_preference_key_check" CHECK ("key" = 'system'),
  CONSTRAINT "system_preference_default_currency_code_check"
    CHECK (
      "default_currency_code" IS NULL
      OR "default_currency_code" ~ '^[A-Z]{3}$'
    )
);

CREATE UNIQUE INDEX "system_preference_uuid_key"
  ON "system_preference"("uuid");
CREATE UNIQUE INDEX "system_preference_key_key"
  ON "system_preference"("key");

-- 9. Copy an unambiguous legacy default, or fail closed for manual
--    reconciliation. The active-code array is the server catalog (SIX list-one
--    published 2026-09-17) with funds, metals, testing codes and units of
--    account excluded.
DO $$
DECLARE
  stored text;
  codes text[];
  chosen text;
  active_codes text[] := ARRAY[
    'AED', 'AFN', 'ALL', 'AMD', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VED', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XCG', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWG'
  ];
BEGIN
  SELECT string_agg(
           format('%s=%s', p.organization_id, coalesce(p.default_currency_code, 'NULL')),
           ', ' ORDER BY p.organization_id
         )
    INTO stored
  FROM "organization_preference" AS p;

  IF stored IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
       SELECT 1 FROM "organization_preference"
       WHERE "default_currency_code" IS NULL
     )
     AND EXISTS (
       SELECT 1 FROM "organization_preference"
       WHERE "default_currency_code" IS NOT NULL
     ) THEN
    RAISE EXCEPTION
      'organization currency defaults conflict: stored preferences are %. Some organizations explicitly store no default while others store a code. Make every organization_preference.default_currency_code identical or NULL, then rerun 20261121000000_system_units_currency.',
      stored;
  END IF;

  SELECT array_agg(DISTINCT p."default_currency_code")
    INTO codes
  FROM "organization_preference" AS p
  WHERE p."default_currency_code" IS NOT NULL;

  IF array_length(codes, 1) > 1 THEN
    RAISE EXCEPTION
      'organization currency defaults conflict: stored preferences are %. Make every organization_preference.default_currency_code identical, then rerun 20261121000000_system_units_currency.',
      stored;
  END IF;

  chosen := codes[1];
  IF chosen IS NOT NULL AND NOT (chosen = ANY (active_codes)) THEN
    RAISE EXCEPTION
      'the agreed organization currency default % is not an active ISO 4217 currency (SIX list published 2026-09-17); stored preferences are %. Set every organization_preference.default_currency_code to an active code or NULL, then rerun. The value is not converted automatically.',
      chosen, stored;
  END IF;

  IF chosen IS NOT NULL THEN
    INSERT INTO "system_preference" ("key", "default_currency_code")
    VALUES ('system', chosen);
  END IF;
END $$;

-- 10. Remove the organization-scoped model and every stored preference row.
DROP TABLE "organization_preference";

COMMIT;
