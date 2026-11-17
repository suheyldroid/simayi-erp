import { Prisma } from "../../../prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  AlertRow,
  DashboardModel,
  MonthlyCountRow,
  SystemTotalsRow,
} from "./model";

const MONTHS = 6;
const ALERT_LIMIT = 8;

export abstract class DashboardService {
  /** All-time totals plus six zero-filled UTC months of new-record counts. */
  static async system(): Promise<DashboardModel["system"]> {
    const now = new Date();
    const year = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();
    const firstMonth = new Date(Date.UTC(year, currentMonth - (MONTHS - 1), 1));
    const nextMonth = new Date(Date.UTC(year, currentMonth + 1, 1));
    const months = Array.from({ length: MONTHS }, (_, index) =>
      new Date(Date.UTC(year, currentMonth - (MONTHS - 1) + index, 1))
        .toISOString()
        .slice(0, 7),
    );
    const from = firstMonth.toISOString();
    const to = nextMonth.toISOString();
    const fromDate = from.slice(0, 10);
    const toDate = to.slice(0, 10);

    const [totalsRows, monthlyRows] = await prisma.$transaction([
      prisma.$queryRaw<SystemTotalsRow[]>`
        SELECT
          (SELECT COUNT(*)::int FROM "user") AS "users",
          (SELECT COUNT(*)::int FROM "organization") AS "organizations",
          (SELECT COUNT(*)::int FROM "build") AS "sales",
          (SELECT COUNT(*)::int FROM "purchase_order") AS "purchases"
      `,
      prisma.$queryRaw<MonthlyCountRow[]>`
        WITH bounds AS (
          SELECT
            ${from}::timestamp AS from_ts,
            ${to}::timestamp AS to_ts,
            ${from}::timestamptz AS from_tz,
            ${to}::timestamptz AS to_tz,
            ${fromDate}::date AS from_date,
            ${toDate}::date AS to_date
        )
        SELECT 'users'::text AS metric,
               to_char(u."createdAt", 'YYYY-MM') AS month,
               COUNT(*)::int AS count
        FROM "user" u CROSS JOIN bounds b
        WHERE u."createdAt" >= b.from_ts AND u."createdAt" < b.to_ts
        GROUP BY 1, 2
        UNION ALL
        SELECT 'organizations'::text,
               to_char(o."createdAt", 'YYYY-MM'),
               COUNT(*)::int
        FROM "organization" o CROSS JOIN bounds b
        WHERE o."createdAt" >= b.from_ts AND o."createdAt" < b.to_ts
        GROUP BY 1, 2
        UNION ALL
        SELECT 'sales'::text,
               to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM'),
               COUNT(*)::int
        FROM "build" s CROSS JOIN bounds b
        WHERE s.created_at >= b.from_tz AND s.created_at < b.to_tz
        GROUP BY 1, 2
        UNION ALL
        SELECT 'purchases'::text,
               to_char(p.creation_date, 'YYYY-MM'),
               COUNT(*)::int
        FROM "purchase_order" p CROSS JOIN bounds b
        WHERE p.creation_date IS NOT NULL
          AND p.creation_date >= b.from_date
          AND p.creation_date < b.to_date
        GROUP BY 1, 2
      `,
    ]);

    const totalsRow = totalsRows.at(0);
    if (!totalsRow) throw new Error("Dashboard totals query returned no rows");

    const counts = new Map<string, number>();
    for (const row of monthlyRows)
      counts.set(`${row.metric}:${row.month}`, row.count);

    return {
      totals: totalsRow,
      months: months.map((month) => ({
        month,
        users: counts.get(`users:${month}`) ?? 0,
        organizations: counts.get(`organizations:${month}`) ?? 0,
        sales: counts.get(`sales:${month}`) ?? 0,
        purchases: counts.get(`purchases:${month}`) ?? 0,
      })),
    };
  }

  /**
   * All-time totals and low-stock alerts for the organizations the requesting
   * user currently belongs to. No owner or creator filter applies.
   *
   * The balance is branch-owned: `part` is the shared company catalog item and
   * the threshold lives per branch. Alert rows are therefore branch/item
   * positions, not items. The zero-row semantics deliberately match the stock
   * screen, which reads a missing balance row as zero stock and zero minimum
   * and treats `stock <= minimum` as below minimum: an active catalog item
   * without a balance row in an active branch is reported at 0/0 rather than
   * silently dropped. Deactivated branches are excluded because they cannot be
   * operated, although their minimums remain stored for reactivation.
   */
  static async personal(userId: string): Promise<DashboardModel["personal"]> {
    // Every business read carries the current-membership predicate itself, so
    // a removed membership takes effect without a preloaded organization list.
    const activeAlerts = Prisma.sql`
      p.active = true
      AND COALESCE(bs.stock, 0) <= COALESCE(bs.minimum_stock, 0)
      AND EXISTS (
        SELECT 1
        FROM "member" m
        WHERE m."organizationId" = p.organization_id
          AND m."userId" = ${userId}
      )
    `;
    const alertSource = Prisma.sql`
      FROM "part" p
      JOIN "branch" b
        ON b.organization_id = p.organization_id
       AND b.active = true
      LEFT JOIN "branch_stock" bs
        ON bs."organization_id" = p.organization_id
       AND bs."item_id" = p."id"
       AND bs."branch_id" = b.id
    `;

    const [sales, purchases, alertCounts, alertRows] =
      await prisma.$transaction([
        prisma.build.count({
          where: { organization: { members: { some: { userId } } } },
        }),
        prisma.purchaseOrder.count({
          where: { organization: { members: { some: { userId } } } },
        }),
        prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
          SELECT COUNT(*)::int AS total
          ${alertSource}
          WHERE ${activeAlerts}
        `),
        prisma.$queryRaw<AlertRow[]>(Prisma.sql`
          SELECT
            p.uuid,
            p.name,
            p.ipn,
            COALESCE(bs.stock, 0) AS stock,
            COALESCE(bs.minimum_stock, 0) AS "minimumStock",
            u."code" AS "units",
            o.name AS "organizationName",
            o.slug AS "organizationSlug",
            b.uuid AS "branchUuid",
            b.name AS "branchName"
          ${alertSource}
          JOIN "organization" o ON o.id = p.organization_id
          LEFT JOIN "unit" u ON u.id = p.unit_id
          WHERE ${activeAlerts}
          ORDER BY (COALESCE(bs.minimum_stock, 0) - COALESCE(bs.stock, 0)) DESC,
                   p.name ASC,
                   b.name ASC,
                   p.uuid ASC,
                   b.uuid ASC
          LIMIT ${ALERT_LIMIT}
        `),
      ]);

    const alertCountRow = alertCounts.at(0);
    if (!alertCountRow)
      throw new Error("Dashboard alert count query returned no rows");

    return {
      totals: { sales, purchases },
      alerts: {
        total: alertCountRow.total,
        items: alertRows.map((row) => ({
          uuid: row.uuid,
          name: row.name,
          ipn: row.ipn,
          stock: row.stock.toString(),
          minimumStock: row.minimumStock.toString(),
          units: row.units,
          organizationName: row.organizationName,
          organizationSlug: row.organizationSlug,
          branchUuid: row.branchUuid,
          branchName: row.branchName,
        })),
      },
    };
  }
}
