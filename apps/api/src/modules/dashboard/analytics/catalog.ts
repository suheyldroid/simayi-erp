import { purchaseOrderStatusOptions } from "@/lib/status";
import {
  maxDashboardWidgets,
  type DashboardDateRange,
  type DashboardSource,
} from "../model";
import type {
  CatalogGroupBy,
  CatalogScope,
  CatalogSource,
  DashboardCatalog,
} from "./model";

const allDateRanges: DashboardDateRange[] = [
  "last_30_days",
  "last_90_days",
  "last_6_months",
  "last_12_months",
  "all_time",
];

const temporalGroupBys: CatalogGroupBy[] = [
  {
    id: "time_day",
    label: "Day (UTC)",
    temporal: true,
    granularity: "day",
    allowedTypes: ["column", "bar", "line"],
    allowedRanges: ["last_30_days"],
  },
  {
    id: "time_week",
    label: "Week (UTC)",
    temporal: true,
    granularity: "week",
    allowedTypes: ["column", "bar", "line"],
    allowedRanges: ["last_90_days", "last_6_months", "last_12_months"],
  },
  {
    id: "time_month",
    label: "Month (UTC)",
    temporal: true,
    granularity: "month",
    allowedTypes: ["column", "bar", "line"],
    allowedRanges: ["last_6_months", "last_12_months"],
  },
];

const dateRangeOptions: DashboardCatalog["dateRanges"] = [
  { id: "last_30_days", label: "Last 30 days (UTC)" },
  { id: "last_90_days", label: "Last 90 days (UTC)" },
  { id: "last_6_months", label: "Last 6 months (UTC)" },
  { id: "last_12_months", label: "Last 12 months (UTC)" },
  { id: "all_time", label: "All time" },
];

const widgetTypeOptions: DashboardCatalog["widgetTypes"] = [
  { id: "kpi", label: "Number (KPI)" },
  { id: "column", label: "Column chart" },
  { id: "bar", label: "Bar chart" },
  { id: "line", label: "Line chart" },
  { id: "donut", label: "Donut chart" },
];

const salesSource = (scope: CatalogScope): CatalogSource => ({
  id: "sales",
  label: "Sales",
  dateBasis: "Sale recorded date (UTC)",
  dateRanges: allDateRanges,
  // Global sales has no categorical grouping, so a donut has no valid axis.
  types:
    scope === "organization"
      ? ["kpi", "column", "bar", "line", "donut"]
      : ["kpi", "column", "bar", "line"],
  measures: [
    { id: "count", label: "Sales count", unitLabel: "sales" },
    ...(scope === "organization"
      ? [{ id: "quantity", label: "Recipe units sold", unitLabel: "units" }]
      : []),
  ],
  groupBys: [
    ...temporalGroupBys,
    ...(scope === "organization"
      ? [
          {
            id: "recipe",
            label: "Recipe (snapshot)",
            temporal: false,
            granularity: null,
            allowedTypes: ["column", "bar", "donut"],
            allowedRanges: [],
          } satisfies CatalogGroupBy,
        ]
      : []),
  ],
  series: [],
  filters: [],
});

const purchaseSource = (scope: CatalogScope): CatalogSource => ({
  id: "purchases",
  label: "Purchase orders",
  dateBasis: "Purchase order creation date (UTC)",
  dateRanges: allDateRanges,
  types: ["kpi", "column", "bar", "line", "donut"],
  measures: [
    { id: "count", label: "Purchase order count", unitLabel: "orders" },
  ],
  groupBys: [
    ...temporalGroupBys,
    {
      id: "status",
      label: "Order status",
      temporal: false,
      granularity: null,
      allowedTypes: ["column", "bar", "donut"],
      allowedRanges: [],
    },
    ...(scope === "organization"
      ? [
          {
            id: "supplier",
            label: "Supplier",
            temporal: false,
            granularity: null,
            allowedTypes: ["column", "bar", "donut"],
            allowedRanges: [],
          } satisfies CatalogGroupBy,
        ]
      : []),
  ],
  series: [{ id: "status", label: "Purchase order status" }],
  filters: [
    {
      id: "statuses",
      label: "Order status filter",
      options: purchaseOrderStatusOptions,
    },
  ],
});

const stockSource = (scope: CatalogScope): CatalogSource => ({
  id: "stock",
  label: "Current stock",
  dateBasis: null,
  dateRanges: [],
  types: ["kpi", "column", "bar", "donut"],
  measures: [
    { id: "critical_count", label: "Critical stock items", unitLabel: "items" },
    ...(scope === "organization"
      ? [{ id: "active_count", label: "Active items", unitLabel: "items" }]
      : []),
  ],
  groupBys:
    scope === "organization"
      ? [
          {
            id: "category",
            label: "Item category",
            temporal: false,
            granularity: null,
            allowedTypes: ["column", "bar", "donut"],
            allowedRanges: [],
          },
        ]
      : [
          {
            id: "organization",
            label: "Organization",
            temporal: false,
            granularity: null,
            allowedTypes: ["column", "bar", "donut"],
            allowedRanges: [],
          },
        ],
  series: [],
  filters: [],
});

const catalogs: Record<CatalogScope, DashboardCatalog> = {
  global: {
    scope: "global",
    schemaVersion: 3,
    maxWidgets: maxDashboardWidgets,
    widgetTypes: widgetTypeOptions,
    dateRanges: dateRangeOptions,
    sources: [
      salesSource("global"),
      purchaseSource("global"),
      stockSource("global"),
    ],
  },
  organization: {
    scope: "organization",
    schemaVersion: 3,
    maxWidgets: maxDashboardWidgets,
    widgetTypes: widgetTypeOptions,
    dateRanges: dateRangeOptions,
    sources: [
      salesSource("organization"),
      purchaseSource("organization"),
      stockSource("organization"),
    ],
  },
};

/** Backend-owned capability catalog. The editor never invents a combination. */
export function dashboardCatalog(scope: CatalogScope): DashboardCatalog {
  return catalogs[scope];
}

export function catalogSource(scope: CatalogScope, source: DashboardSource) {
  return dashboardCatalog(scope).sources.find((entry) => entry.id === source);
}

export function catalogRangeLabel(range: DashboardDateRange): string {
  return (
    dateRangeOptions.find((entry) => entry.id === range)?.label ?? String(range)
  );
}
