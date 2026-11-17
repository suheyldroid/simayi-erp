import createError from "http-errors";
import {
  dashboardDateRanges,
  dashboardGridColumns,
  dashboardSources,
  dashboardWidgetTypes,
  maxDashboardWidgets,
  type DashboardDateRange,
  type DashboardDefinition,
  type DashboardSource,
  type DashboardWidget,
  type DashboardWidgetType,
} from "../model";
import { catalogSource } from "./catalog";
import type { CatalogGroupBy, CatalogScope, CatalogSource } from "./model";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalid(path: string, message: string): never {
  const error = createError.BadRequest(message);
  Object.assign(error, {
    apiCode: "DASHBOARD_INVALID",
    details: { path },
  });
  throw error;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    invalid(path, "Expected an object");
  return value as Record<string, unknown>;
}

function rejectExtraKeys(
  value: Record<string, unknown>,
  allowed: string[],
  path: string,
) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key))
      invalid(`${path}.${key}`, `Unsupported field "${key}"`);
  }
}

function text(
  value: unknown,
  path: string,
  options: { min?: number; max: number },
): string {
  if (typeof value !== "string") invalid(path, "Expected a string");
  if (value.length < (options.min ?? 1) || value.length > options.max)
    invalid(
      path,
      `Expected a string between ${options.min ?? 1} and ${options.max} characters`,
    );
  return value;
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T))
    invalid(path, "Unsupported value");
  return value as T;
}

function integer(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    invalid(path, "Expected an integer");
  if (value < minimum || value > maximum)
    invalid(path, `Expected an integer between ${minimum} and ${maximum}`);
  return value;
}

/**
 * Row coordinates and row heights have no product cap. They only have to be
 * safe integers so every derived value (and pixel height) stays exact.
 */
function safeInteger(value: unknown, path: string, minimum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value))
    invalid(path, "Expected a safe integer");
  if (value < minimum)
    invalid(path, `Expected an integer of at least ${minimum}`);
  return value;
}

function findGroupBy(
  source: CatalogSource,
  groupBy: string,
  path: string,
): CatalogGroupBy {
  const found = source.groupBys.find((entry) => entry.id === groupBy);
  if (!found) invalid(path, `Unsupported grouping for ${source.label}`);
  return found;
}

function validateWidget(
  value: unknown,
  scope: CatalogScope,
  path: string,
): DashboardWidget {
  const widget = record(value, path);
  rejectExtraKeys(
    widget,
    [
      "id",
      "type",
      "title",
      "x",
      "y",
      "w",
      "h",
      "source",
      "measure",
      "groupBy",
      "seriesBy",
      "dateRange",
      "filters",
    ],
    path,
  );

  const id = text(widget.id, `${path}.id`, { max: 36 }).toLowerCase();
  if (!uuidPattern.test(id)) invalid(`${path}.id`, "Expected a UUID");

  const type: DashboardWidgetType = oneOf(
    widget.type,
    dashboardWidgetTypes,
    `${path}.type`,
  );
  const title = text(widget.title, `${path}.title`, { max: 80 });
  if (title.trim().length === 0) invalid(`${path}.title`, "Title is required");

  const x = integer(widget.x, `${path}.x`, 0, dashboardGridColumns - 1);
  const y = safeInteger(widget.y, `${path}.y`, 0);
  const w = integer(widget.w, `${path}.w`, 1, dashboardGridColumns);
  const h = safeInteger(widget.h, `${path}.h`, 1);
  if (!Number.isSafeInteger(y + h))
    invalid(`${path}.h`, "Card geometry is too large");
  if (x + w > dashboardGridColumns)
    invalid(`${path}.x`, "A card must fit inside the four grid columns");

  const sourceId: DashboardSource = oneOf(
    widget.source,
    dashboardSources,
    `${path}.source`,
  );
  const source = catalogSource(scope, sourceId);
  if (!source) invalid(`${path}.source`, "Unsupported source for this scope");
  if (!source.types.includes(type))
    invalid(`${path}.type`, `${type} is not available for ${source.label}`);

  const measure = text(widget.measure, `${path}.measure`, { max: 40 });
  if (!source.measures.some((entry) => entry.id === measure))
    invalid(`${path}.measure`, "Unsupported measure for this source");

  let groupById: string | null = null;
  let groupBy: CatalogGroupBy | null = null;
  if (widget.groupBy === null) {
    if (type !== "kpi")
      invalid(`${path}.groupBy`, "This visual type requires a grouping");
  } else {
    groupById = text(widget.groupBy, `${path}.groupBy`, { max: 40 });
    if (type === "kpi")
      invalid(`${path}.groupBy`, "A KPI has no grouping axis");
    groupBy = findGroupBy(source, groupById, `${path}.groupBy`);
    if (!groupBy.allowedTypes.includes(type))
      invalid(
        `${path}.type`,
        `${type} is not available for ${groupBy.label} grouping`,
      );
    if (type === "line" && (!groupBy.temporal || !groupBy.granularity))
      invalid(`${path}.groupBy`, "A line chart requires a time grouping");
    if (type === "donut" && groupBy.temporal)
      invalid(
        `${path}.groupBy`,
        "A donut chart requires a categorical grouping",
      );
  }

  let dateRange: DashboardDateRange | null = null;
  if (source.dateBasis === null) {
    if (widget.dateRange !== null)
      invalid(
        `${path}.dateRange`,
        "Current stock is a snapshot with no date range",
      );
  } else {
    if (widget.dateRange === null)
      invalid(`${path}.dateRange`, "A date range is required for this source");
    dateRange = oneOf(
      widget.dateRange,
      dashboardDateRanges,
      `${path}.dateRange`,
    );
    if (groupBy?.temporal) {
      if (!groupBy.allowedRanges.includes(dateRange))
        invalid(
          `${path}.dateRange`,
          `${dateRange} is not available for ${groupBy.label} buckets`,
        );
    } else if (!source.dateRanges.includes(dateRange)) {
      invalid(
        `${path}.dateRange`,
        "Date range is not available for this source",
      );
    }
  }

  let seriesBy: "status" | null = null;
  if (widget.seriesBy !== null) {
    seriesBy = oneOf(widget.seriesBy, ["status"] as const, `${path}.seriesBy`);
    if (!source.series.some((entry) => entry.id === seriesBy))
      invalid(
        `${path}.seriesBy`,
        "Series split is not available for this source",
      );
    if (!groupBy?.temporal || !["line", "column"].includes(type))
      invalid(
        `${path}.seriesBy`,
        "A status series split requires a temporal line or column chart",
      );
  }

  const filters = record(widget.filters, `${path}.filters`);
  rejectExtraKeys(filters, ["statuses"], `${path}.filters`);
  const rawStatuses = filters.statuses;
  if (!Array.isArray(rawStatuses))
    invalid(`${path}.filters.statuses`, "Expected a status list");
  const statusFilter = source.filters.find((entry) => entry.id === "statuses");
  const statuses: number[] = [];
  for (const [index, rawStatus] of rawStatuses.entries()) {
    const statusPath = `${path}.filters.statuses[${index}]`;
    if (typeof rawStatus !== "number" || !Number.isInteger(rawStatus))
      invalid(statusPath, "Expected an integer status");
    if (!statusFilter)
      invalid(statusPath, "Status filters are not available for this source");
    if (!statusFilter.options.some((option) => option.value === rawStatus))
      invalid(statusPath, "Unknown purchase order status");
    if (statuses.includes(rawStatus))
      invalid(statusPath, "Duplicate purchase order status");
    statuses.push(rawStatus);
  }

  return {
    id,
    type,
    title,
    x,
    y,
    w,
    h,
    source: source.id,
    measure,
    groupBy: groupById,
    seriesBy,
    dateRange,
    filters: { statuses },
  };
}

/** Strictly validates a widget list in the given dashboard context. */
export function validateWidgetList(
  value: unknown,
  scope: CatalogScope,
  path = "widgets",
): DashboardWidget[] {
  if (!Array.isArray(value)) invalid(path, "Expected a widget list");
  if (value.length > maxDashboardWidgets)
    invalid(path, `At most ${maxDashboardWidgets} widgets are supported`);
  const widgets = value.map((entry, index) =>
    validateWidget(entry, scope, `${path}[${index}]`),
  );
  const ids = new Set<string>();
  for (const [index, widget] of widgets.entries()) {
    if (ids.has(widget.id))
      invalid(`${path}[${index}].id`, "Duplicate widget id");
    ids.add(widget.id);
  }
  // Rectangle-pair checks only: a card's height is any positive integer, so
  // marking occupied cells would allocate and iterate without a bound.
  for (const [left, first] of widgets.entries())
    for (const [right, second] of widgets.entries()) {
      if (right <= left) continue;
      if (
        first.x < second.x + second.w &&
        second.x < first.x + first.w &&
        first.y < second.y + second.h &&
        second.y < first.y + first.h
      )
        invalid(`${path}[${right}]`, "Cards must not overlap");
    }
  return widgets;
}

/** Strictly validates a complete saved definition. */
export function validateDefinition(
  value: unknown,
  scope: CatalogScope,
  path = "definition",
): DashboardDefinition {
  const definition = record(value, path);
  rejectExtraKeys(definition, ["version", "widgets"], path);
  if (definition.version !== 3)
    invalid(`${path}.version`, "Unsupported dashboard definition version");
  return {
    version: 3,
    widgets: validateWidgetList(definition.widgets, scope, `${path}.widgets`),
  };
}

/**
 * Query fingerprint used only to reuse identical batch aggregation queries.
 * Layout, title and visual type do not affect the aggregate itself.
 */
export function widgetQueryFingerprint(widget: DashboardWidget): string {
  return JSON.stringify([
    widget.source,
    widget.measure,
    widget.groupBy,
    widget.seriesBy,
    widget.dateRange,
    [...widget.filters.statuses].sort((left, right) => left - right),
  ]);
}
