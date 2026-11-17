import { prisma } from "@/lib/prisma";
import {
  purchaseOrderStatusLabel,
  purchaseOrderStatusOptions,
} from "@/lib/status";
import { Prisma } from "../../../../prisma/generated/prisma/client";
import type {
  DashboardDateRange,
  DashboardGranularity,
  DashboardWidget,
} from "../model";
import { catalogRangeLabel, catalogSource } from "./catalog";
import { validateWidgetList, widgetQueryFingerprint } from "./definition";
import type { DashboardDataResponse, DashboardWidgetResult } from "./model";

export type AnalyticsScope =
  | { kind: "global"; userId: string }
  | {
      kind: "organization";
      organizationId: string;
      /** Selected branch, or null for the explicit company roll-up. */
      branchId: number | null;
    };

type ResolvedRange = {
  label: string;
  start: Date;
  end: Date;
  /** Day string for the nullable SQL DATE column `purchase_order.creation_date`. */
  fromDate: string;
  toDate: string;
};

type ResolvedData = Omit<DashboardWidgetResult, "id" | "type">;
type Bucket = { key: string; label: string };
type Group = { key: string; label: string; value: number };
type ValueRow = { value: string };
type KeyedValueRow = { key: string; value: string };
type StatusValueRow = { bucket: string; status: string; value: string };
type TopRow = {
  kind: "head" | "other";
  key: string | null;
  label: string | null;
  value: string;
};

const MAX_TEMPORAL_BUCKETS = 60;
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function startOfUtcWeek(date: Date): Date {
  const day = date.getUTCDay();
  return addUtcDays(startOfUtcDay(date), -((day + 6) % 7));
}

function makeRange(
  range: DashboardDateRange,
  start: Date,
  end: Date,
): ResolvedRange {
  return {
    label: catalogRangeLabel(range),
    start,
    end,
    fromDate: start.toISOString().slice(0, 10),
    toDate: end.toISOString().slice(0, 10),
  };
}

/** Half-open UTC presets. `all_time` returns null: no date predicate at all. */
function resolveRange(
  range: DashboardDateRange | null,
  now: Date,
): ResolvedRange | null {
  if (range === null || range === "all_time") return null;
  const today = startOfUtcDay(now);
  if (range === "last_30_days")
    return makeRange(range, addUtcDays(today, -29), addUtcDays(today, 1));
  if (range === "last_90_days")
    return makeRange(range, addUtcDays(today, -89), addUtcDays(today, 1));
  const months = range === "last_6_months" ? 6 : 12;
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (months - 1), 1),
  );
  const end = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1),
  );
  return makeRange(range, start, end);
}

function countValue(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0)
    throw new Error("Dashboard aggregate is out of range");
  return parsed;
}

function bucketKey(granularity: DashboardGranularity, date: Date): string {
  return date.toISOString().slice(0, granularity === "month" ? 7 : 10);
}

function bucketLabel(granularity: DashboardGranularity, date: Date): string {
  const month = MONTH_NAMES[date.getUTCMonth()] ?? "";
  const day = `${month} ${date.getUTCDate()}`;
  if (granularity === "month") return `${month} ${date.getUTCFullYear()}`;
  if (granularity === "week") return `Week of ${day}`;
  return day;
}

/** Zero-filled bucket list, bounded for every allowed preset. */
function temporalBuckets(
  granularity: DashboardGranularity,
  range: ResolvedRange,
): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor =
    granularity === "week"
      ? startOfUtcWeek(range.start)
      : granularity === "month"
        ? new Date(
            Date.UTC(
              range.start.getUTCFullYear(),
              range.start.getUTCMonth(),
              1,
            ),
          )
        : startOfUtcDay(range.start);
  while (cursor.getTime() < range.end.getTime()) {
    buckets.push({
      key: bucketKey(granularity, cursor),
      label: bucketLabel(granularity, cursor),
    });
    if (buckets.length > MAX_TEMPORAL_BUCKETS)
      throw new Error("Dashboard temporal range exceeds its bucket bound");
    cursor =
      granularity === "month"
        ? new Date(
            Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
          )
        : addUtcDays(cursor, granularity === "week" ? 7 : 1);
  }
  return buckets;
}

function scopePredicate(scope: AnalyticsScope, alias: string): Prisma.Sql {
  if (scope.kind === "organization")
    return Prisma.sql`${Prisma.raw(alias)}."organization_id" = ${scope.organizationId}`;
  return Prisma.sql`EXISTS (
    SELECT 1 FROM "member" m
    WHERE m."organizationId" = ${Prisma.raw(alias)}."organization_id"
      AND m."userId" = ${scope.userId}
  )`;
}

function salesDateRange(
  alias: string,
  range: ResolvedRange | null,
): Prisma.Sql {
  if (!range) return Prisma.empty;
  return Prisma.sql`AND ${Prisma.raw(alias)}."created_at" >= ${range.start}::timestamptz
    AND ${Prisma.raw(alias)}."created_at" < ${range.end}::timestamptz`;
}

function purchaseDateRange(range: ResolvedRange | null): Prisma.Sql {
  if (!range) return Prisma.empty;
  return Prisma.sql`AND po."creation_date" IS NOT NULL
    AND po."creation_date" >= ${range.fromDate}::date
    AND po."creation_date" < ${range.toDate}::date`;
}

function purchaseStatusFilter(statuses: number[]): Prisma.Sql {
  if (statuses.length === 0) return Prisma.empty;
  return Prisma.sql`AND po."status" IN (${Prisma.join(statuses)})`;
}

function salesMeasure(measure: string): Prisma.Sql {
  return measure === "quantity"
    ? Prisma.sql`COALESCE(SUM(b."quantity"), 0)::text`
    : Prisma.sql`COUNT(*)::text`;
}

/**
 * Balance join for the stock source. `active_count` is the shared company
 * catalog size and must never be multiplied by branch balances, so it joins
 * nothing. `critical_count` counts branch/item positions: a selected branch
 * left-joins its own balance, while a global or company roll-up pairs every
 * active catalog item with each active branch of the in-scope companies, so a
 * branch with no balance rows still contributes its zero balances.
 */
function stockBalanceJoin(scope: AnalyticsScope, measure: string): Prisma.Sql {
  if (measure !== "critical_count") return Prisma.empty;
  if (scope.kind === "organization" && scope.branchId !== null)
    return Prisma.sql`
      LEFT JOIN "branch_stock" bs
        ON bs."organization_id" = p."organization_id"
       AND bs."item_id" = p."id"
       AND bs."branch_id" = ${scope.branchId}`;
  return Prisma.sql`
    JOIN "branch" b
      ON b."organization_id" = p."organization_id"
     AND b."active" = true
    LEFT JOIN "branch_stock" bs
      ON bs."organization_id" = p."organization_id"
     AND bs."item_id" = p."id"
     AND bs."branch_id" = b."id"`;
}

/**
 * Deliberate zero-row semantics matching the stock screen: a missing balance
 * row is zero stock and zero minimum, and the screen treats
 * `stock <= minimum` as below minimum, so such a position is critical rather
 * than silently dropped.
 */
function stockCriticalFilter(measure: string): Prisma.Sql {
  return measure === "critical_count"
    ? Prisma.sql`AND COALESCE(bs."stock", 0) <= COALESCE(bs."minimum_stock", 0)`
    : Prisma.empty;
}

/** Selected branch narrows recorded sales; company roll-up spans branches. */
function salesBranchFilter(scope: AnalyticsScope, alias: string): Prisma.Sql {
  if (scope.kind !== "organization" || scope.branchId === null)
    return Prisma.empty;
  return Prisma.sql`AND ${Prisma.raw(alias)}."branch_id" = ${scope.branchId}`;
}

/** Branch purchase visibility follows the order ORIGIN, never receipt targets. */
function purchaseBranchFilter(scope: AnalyticsScope): Prisma.Sql {
  if (scope.kind !== "organization" || scope.branchId === null)
    return Prisma.empty;
  return Prisma.sql`AND po."branch_id" = ${scope.branchId}`;
}

function salesBucket(
  granularity: DashboardGranularity,
  alias: string,
): Prisma.Sql {
  const pattern = granularity === "month" ? "YYYY-MM" : "YYYY-MM-DD";
  return Prisma.sql`to_char(
    date_trunc(${granularity}::text, ${Prisma.raw(alias)}."created_at" AT TIME ZONE 'UTC'),
    ${pattern}::text
  )`;
}

function purchaseBucket(
  granularity: DashboardGranularity,
  alias: string,
): Prisma.Sql {
  const pattern = granularity === "month" ? "YYYY-MM" : "YYYY-MM-DD";
  return Prisma.sql`to_char(
    date_trunc(${granularity}::text, ${Prisma.raw(alias)}."creation_date"::timestamp),
    ${pattern}::text
  )`;
}

/** Top ten group values plus one exact Other bucket, ranked in PostgreSQL. */
function rankedGroups(grouped: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    WITH grouped AS (${grouped}),
    ranked AS (
      SELECT key, label, value,
             ROW_NUMBER() OVER (
               ORDER BY value::bigint DESC, label ASC NULLS LAST, key ASC
             ) AS rn
      FROM grouped
    )
    SELECT kind, key, label, value
    FROM (
      SELECT 'head'::text AS kind, key, label, value,
             rn AS ordinal, 0 AS bucket_order
      FROM ranked
      WHERE rn <= 10
      UNION ALL
      SELECT 'other'::text, NULL::text, 'Other'::text, SUM(value::bigint)::text,
             NULL::bigint, 1
      FROM ranked
      WHERE rn > 10
      HAVING COUNT(*) > 0
    ) ordered
    ORDER BY ordered.bucket_order ASC,
             ordered.ordinal ASC NULLS LAST,
             ordered.label ASC NULLS LAST,
             ordered.key ASC
  `;
}

function topGroups(rows: TopRow[], statusLabels: boolean): Group[] {
  return rows.map((row) => {
    if (row.kind === "other")
      return { key: "__other__", label: "Other", value: countValue(row.value) };
    // Reserved system keys stay unprefixed; every stored key is namespaced so a
    // company slug, uuid or status value can never read as a system bucket.
    const rawKey = row.key ?? "";
    const label = statusLabels
      ? purchaseOrderStatusLabel(Number(rawKey))
      : (row.label ?? rawKey);
    return { key: `group:${rawKey}`, label, value: countValue(row.value) };
  });
}

export abstract class DashboardAnalyticsService {
  /** Resolves a bounded batch of widgets, reusing identical aggregate queries. */
  static async resolveMany(
    widgets: DashboardWidget[],
    scope: AnalyticsScope,
  ): Promise<DashboardDataResponse> {
    const validated = validateWidgetList(
      widgets,
      scope.kind === "global" ? "global" : "organization",
    );
    const asOf = new Date().toISOString();
    const cache = new Map<string, Promise<ResolvedData>>();
    const results = await Promise.all(
      validated.map(async (widget) => {
        const fingerprint = widgetQueryFingerprint(widget);
        let pending = cache.get(fingerprint);
        if (!pending) {
          pending = DashboardAnalyticsService.resolve(widget, scope, asOf);
          cache.set(fingerprint, pending);
        }
        const data = await pending;
        return { ...data, id: widget.id, type: widget.type };
      }),
    );
    return { asOf, results };
  }

  private static async resolve(
    widget: DashboardWidget,
    scope: AnalyticsScope,
    asOf: string,
  ): Promise<ResolvedData> {
    const catalogScope = scope.kind === "global" ? "global" : "organization";
    const source = catalogSource(catalogScope, widget.source);
    if (!source) throw new Error("Unsupported dashboard source");
    const measure = source.measures.find(
      (entry) => entry.id === widget.measure,
    );
    if (!measure) throw new Error("Unsupported dashboard measure");
    const groupBy = widget.groupBy
      ? source.groupBys.find((entry) => entry.id === widget.groupBy)
      : null;
    const now = new Date(asOf);
    const range = resolveRange(widget.dateRange, now);
    const rangeLabel =
      widget.dateRange === null
        ? null
        : (range?.label ?? catalogRangeLabel(widget.dateRange));

    const base = {
      measure: widget.measure,
      measureLabel: measure.label,
      unitLabel: measure.unitLabel,
      temporal: groupBy?.temporal ?? false,
      granularity:
        groupBy?.temporal && groupBy.granularity ? groupBy.granularity : null,
      rangeLabel,
      dateBasis: source.dateBasis,
      asOf,
    };

    if (!groupBy) {
      const total = await DashboardAnalyticsService.total(widget, scope, range);
      return {
        ...base,
        total,
        categories: ["Total"],
        categoryKeys: ["total"],
        series: [{ key: "total", label: measure.label, values: [total] }],
      };
    }

    if (groupBy.temporal && groupBy.granularity) {
      if (!range)
        throw new Error("Temporal dashboard widget is missing its date range");
      const buckets = temporalBuckets(groupBy.granularity, range);
      if (widget.source === "purchases" && widget.seriesBy === "status") {
        const seriesResult =
          await DashboardAnalyticsService.purchaseStatusSeries(
            widget,
            scope,
            range,
            groupBy.granularity,
            buckets,
            measure.label,
          );
        return { ...base, ...seriesResult };
      }
      const values = await DashboardAnalyticsService.temporalValues(
        widget,
        scope,
        range,
        groupBy.granularity,
        buckets,
      );
      return {
        ...base,
        total: countValue(values.reduce((sum, value) => sum + value, 0)),
        categories: buckets.map((bucket) => bucket.label),
        categoryKeys: buckets.map((bucket) => bucket.key),
        series: [{ key: "value", label: measure.label, values }],
      };
    }

    const groups = await DashboardAnalyticsService.categoricalGroups(
      widget,
      scope,
      range,
    );
    return {
      ...base,
      total: countValue(
        groups.reduce((total, group) => total + group.value, 0),
      ),
      categories: groups.map((group) => group.label),
      categoryKeys: groups.map((group) => group.key),
      series: [
        {
          key: "value",
          label: measure.label,
          values: groups.map((group) => group.value),
        },
      ],
    };
  }

  private static async total(
    widget: DashboardWidget,
    scope: AnalyticsScope,
    range: ResolvedRange | null,
  ): Promise<number> {
    if (widget.source === "sales") {
      const rows = await prisma.$queryRaw<ValueRow[]>(Prisma.sql`
        SELECT ${salesMeasure(widget.measure)} AS value
        FROM "build" b
        WHERE ${scopePredicate(scope, "b")}
        ${salesBranchFilter(scope, "b")}
        ${salesDateRange("b", range)}
      `);
      return countValue(rows[0]?.value ?? "0");
    }
    if (widget.source === "purchases") {
      const rows = await prisma.$queryRaw<ValueRow[]>(Prisma.sql`
        SELECT COUNT(*)::text AS value
        FROM "purchase_order" po
        WHERE ${scopePredicate(scope, "po")}
        ${purchaseBranchFilter(scope)}
        ${purchaseDateRange(range)}
        ${purchaseStatusFilter(widget.filters.statuses)}
      `);
      return countValue(rows[0]?.value ?? "0");
    }
    const rows = await prisma.$queryRaw<ValueRow[]>(Prisma.sql`
      SELECT COUNT(*)::text AS value
      FROM "part" p
      ${stockBalanceJoin(scope, widget.measure)}
      WHERE ${scopePredicate(scope, "p")}
        AND p."active" = true
        ${stockCriticalFilter(widget.measure)}
    `);
    return countValue(rows[0]?.value ?? "0");
  }

  private static async temporalValues(
    widget: DashboardWidget,
    scope: AnalyticsScope,
    range: ResolvedRange,
    granularity: DashboardGranularity,
    buckets: Bucket[],
  ): Promise<number[]> {
    let rows: KeyedValueRow[];
    if (widget.source === "sales") {
      rows = await prisma.$queryRaw<KeyedValueRow[]>(Prisma.sql`
        SELECT ${salesBucket(granularity, "b")} AS key,
               ${salesMeasure(widget.measure)} AS value
        FROM "build" b
        WHERE ${scopePredicate(scope, "b")}
        ${salesBranchFilter(scope, "b")}
        ${salesDateRange("b", range)}
        GROUP BY 1
      `);
    } else {
      rows = await prisma.$queryRaw<KeyedValueRow[]>(Prisma.sql`
        SELECT ${purchaseBucket(granularity, "po")} AS key,
               COUNT(*)::text AS value
        FROM "purchase_order" po
        WHERE ${scopePredicate(scope, "po")}
        ${purchaseBranchFilter(scope)}
        ${purchaseDateRange(range)}
        ${purchaseStatusFilter(widget.filters.statuses)}
        GROUP BY 1
      `);
    }
    const values = new Map<string, string>(
      rows.map((row): [string, string] => [row.key, row.value]),
    );
    return buckets.map((bucket) => countValue(values.get(bucket.key) ?? "0"));
  }

  private static async purchaseStatusSeries(
    widget: DashboardWidget,
    scope: AnalyticsScope,
    range: ResolvedRange,
    granularity: DashboardGranularity,
    buckets: Bucket[],
    measureLabel: string,
  ): Promise<
    Pick<ResolvedData, "total" | "categories" | "categoryKeys" | "series">
  > {
    const rows = await prisma.$queryRaw<StatusValueRow[]>(Prisma.sql`
      SELECT ${purchaseBucket(granularity, "po")} AS bucket,
             po."status"::text AS status,
             COUNT(*)::text AS value
      FROM "purchase_order" po
      WHERE ${scopePredicate(scope, "po")}
      ${purchaseBranchFilter(scope)}
      ${purchaseDateRange(range)}
      ${purchaseStatusFilter(widget.filters.statuses)}
      GROUP BY 1, 2
    `);
    const observed = [...new Set(rows.map((row) => Number(row.status)))].filter(
      (status) => Number.isInteger(status),
    );
    const nativeOrder = purchaseOrderStatusOptions.map((entry) => entry.value);
    const ordered =
      widget.filters.statuses.length > 0
        ? nativeOrder.filter((status) =>
            widget.filters.statuses.includes(status),
          )
        : [
            ...nativeOrder.filter((status) => observed.includes(status)),
            ...observed
              .filter((status) => !nativeOrder.includes(status))
              .sort((left, right) => left - right),
          ];
    const values = new Map<string, string>(
      rows.map((row): [string, string] => [
        `${row.bucket}:${row.status}`,
        row.value,
      ]),
    );
    const total = rows.reduce((sum, row) => sum + countValue(row.value), 0);
    const series =
      ordered.length === 0
        ? [
            {
              key: "total",
              label: measureLabel,
              values: buckets.map(() => 0),
            },
          ]
        : ordered.map((status) => ({
            key: String(status),
            label: purchaseOrderStatusLabel(status),
            values: buckets.map((bucket) =>
              countValue(values.get(`${bucket.key}:${status}`) ?? "0"),
            ),
          }));
    return {
      total,
      categories: buckets.map((bucket) => bucket.label),
      categoryKeys: buckets.map((bucket) => bucket.key),
      series,
    };
  }

  private static async categoricalGroups(
    widget: DashboardWidget,
    scope: AnalyticsScope,
    range: ResolvedRange | null,
  ): Promise<Group[]> {
    let grouped: Prisma.Sql;
    if (widget.source === "purchases" && widget.groupBy === "status") {
      grouped = Prisma.sql`
        SELECT po."status"::text AS key,
               po."status"::text AS label,
               COUNT(*)::text AS value
        FROM "purchase_order" po
        WHERE ${scopePredicate(scope, "po")}
        ${purchaseBranchFilter(scope)}
        ${purchaseDateRange(range)}
        ${purchaseStatusFilter(widget.filters.statuses)}
        GROUP BY po."status"
      `;
    } else if (widget.source === "purchases" && widget.groupBy === "supplier") {
      grouped = Prisma.sql`
        SELECT COALESCE(s."uuid"::text, '') AS key,
               COALESCE(s."name", 'No supplier') AS label,
               COUNT(*)::text AS value
        FROM "purchase_order" po
        LEFT JOIN "supplier" s
          ON s."id" = po."supplier_id"
         AND s."organization_id" = po."organization_id"
        WHERE ${scopePredicate(scope, "po")}
        ${purchaseBranchFilter(scope)}
        ${purchaseDateRange(range)}
        ${purchaseStatusFilter(widget.filters.statuses)}
        GROUP BY 1, 2
      `;
    } else if (widget.source === "sales" && widget.groupBy === "recipe") {
      grouped = Prisma.sql`
        SELECT grouped_sales."requested_recipe_uuid"::text AS key,
               latest_sale."recipe_name" AS label,
               grouped_sales."value" AS value
        FROM (
          SELECT b."requested_recipe_uuid" AS requested_recipe_uuid,
                 ${salesMeasure(widget.measure)} AS value
          FROM "build" b
          WHERE ${scopePredicate(scope, "b")}
          ${salesBranchFilter(scope, "b")}
          ${salesDateRange("b", range)}
          GROUP BY b."requested_recipe_uuid"
        ) grouped_sales
        LEFT JOIN LATERAL (
          SELECT b2."recipe_name" AS recipe_name
          FROM "build" b2
          WHERE b2."requested_recipe_uuid" = grouped_sales."requested_recipe_uuid"
            AND ${scopePredicate(scope, "b2")}
            ${salesBranchFilter(scope, "b2")}
            ${salesDateRange("b2", range)}
          ORDER BY b2."created_at" DESC, b2."uuid" DESC
          LIMIT 1
        ) latest_sale ON true
      `;
    } else if (widget.source === "stock" && widget.groupBy === "category") {
      grouped = Prisma.sql`
        SELECT COALESCE(c."uuid"::text, '') AS key,
               COALESCE(c."name", 'Uncategorized') AS label,
               COUNT(*)::text AS value
        FROM "part" p
        ${stockBalanceJoin(scope, widget.measure)}
        LEFT JOIN "part_category" c
          ON c."id" = p."category_id"
         AND c."organization_id" = p."organization_id"
        WHERE ${scopePredicate(scope, "p")}
          AND p."active" = true
          ${stockCriticalFilter(widget.measure)}
        GROUP BY 1, 2
      `;
    } else if (widget.source === "stock" && widget.groupBy === "organization") {
      grouped = Prisma.sql`
        SELECT o."slug" AS key,
               o."name" AS label,
               COUNT(*)::text AS value
        FROM "part" p
        ${stockBalanceJoin(scope, widget.measure)}
        JOIN "organization" o ON o."id" = p."organization_id"
        WHERE ${scopePredicate(scope, "p")}
          AND p."active" = true
          ${stockCriticalFilter(widget.measure)}
        GROUP BY o."slug", o."name"
      `;
    } else {
      throw new Error("Unsupported dashboard grouping");
    }

    const rows = await prisma.$queryRaw<TopRow[]>(rankedGroups(grouped));
    return topGroups(
      rows,
      widget.source === "purchases" && widget.groupBy === "status",
    );
  }
}
