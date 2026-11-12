import {
  dashboardGridColumns,
  type CatalogGroupBy,
  type CatalogSource,
  type DashboardCatalog,
  type DashboardWidget,
  type WidgetType,
} from './model'

function findSource(catalog: DashboardCatalog, id: string) {
  return catalog.sources.find((source) => source.id === id)
}

function findGroupBy(source: CatalogSource, id: string | null) {
  if (!id) return null
  return source.groupBys.find((group) => group.id === id) ?? null
}

function preferredRange(options: readonly string[]): string | null {
  for (const candidate of [
    'last_12_months',
    'last_6_months',
    'last_90_days',
    'last_30_days',
    'all_time',
  ])
    if (options.includes(candidate)) return candidate
  return options[0] ?? null
}

export function groupByOptionsFor(source: CatalogSource, type: WidgetType) {
  if (type === 'kpi') return []
  return source.groupBys.filter((group) => group.allowedTypes.includes(type))
}

export function dateRangeOptionsFor(
  catalog: DashboardCatalog,
  source: CatalogSource,
  group: CatalogGroupBy | null
) {
  if (source.dateBasis === null) return []
  const ids = group?.temporal ? group.allowedRanges : source.dateRanges
  return catalog.dateRanges.filter((range) => ids.includes(range.id))
}

export function canSplitByStatus(
  source: CatalogSource,
  widget: DashboardWidget,
  group: CatalogGroupBy | null
) {
  return (
    source.series.some((series) => series.id === 'status') &&
    group?.temporal === true &&
    (widget.type === 'line' || widget.type === 'column')
  )
}

export function statusFilter(source: CatalogSource) {
  return source.filters.find((filter) => filter.id === 'statuses') ?? null
}

function supportsType(source: CatalogSource, type: WidgetType) {
  if (!source.types.includes(type)) return false
  if (type === 'kpi') return true
  return source.groupBys.some(
    (group) =>
      group.allowedTypes.includes(type) &&
      (type !== 'line' || group.temporal) &&
      (type !== 'donut' || !group.temporal)
  )
}

/**
 * Predictably removes incompatible options after a type/source/measure change
 * so the form and the preview always describe a combination the server allows.
 * A visual-type change may move to a source that supports it; a source change
 * keeps that source and normalizes the type/grouping instead.
 */
export function normalizeWidget(
  widget: DashboardWidget,
  catalog: DashboardCatalog,
  allowSourceChange = false
): DashboardWidget {
  let source = findSource(catalog, widget.source)
  if (allowSourceChange && (!source || !supportsType(source, widget.type))) {
    source =
      catalog.sources.find((entry) => supportsType(entry, widget.type)) ??
      source
  }
  if (!source) source = catalog.sources[0]
  if (!source) return widget
  let type = widget.type
  if (!source.types.includes(type)) type = source.types[0] ?? 'kpi'

  const measure =
    source.measures.find((entry) => entry.id === widget.measure) ??
    source.measures[0]

  let groupBy: string | null
  if (type === 'kpi') groupBy = null
  else {
    const selected = source.groupBys.find(
      (group) =>
        group.id === widget.groupBy && group.allowedTypes.includes(type)
    )
    const fallback = source.groupBys.find((group) =>
      group.allowedTypes.includes(type)
    )
    groupBy = (selected ?? fallback)?.id ?? null
    if (!groupBy) type = 'kpi'
  }
  const group = findGroupBy(source, groupBy)

  let dateRange = widget.dateRange
  if (source.dateBasis === null) dateRange = null
  else {
    const options = (
      group?.temporal ? group.allowedRanges : source.dateRanges
    ) as readonly string[]
    if (!dateRange || !options.includes(dateRange)) {
      const preferred = preferredRange(options)
      dateRange = (preferred as DashboardWidget['dateRange']) ?? null
    }
  }

  let seriesBy = widget.seriesBy
  if (
    seriesBy !== 'status' ||
    !canSplitByStatus(source, { ...widget, type }, group)
  )
    seriesBy = null

  let statuses = widget.filters.statuses
  const filter = statusFilter(source)
  if (!filter) statuses = []
  else
    statuses = [
      ...new Set(
        statuses.filter((status) =>
          filter.options.some((option) => option.value === status)
        )
      ),
    ]

  // The card's native grid size and position are never normalized: every width
  // and height is valid for every visual type, and choosing a type must not
  // resize or move the card.
  return {
    ...widget,
    type,
    measure: measure?.id ?? '',
    groupBy,
    seriesBy,
    dateRange,
    filters: { statuses },
  }
}

/** A fresh card with catalog-valid defaults; the editor can then adjust it. */
export function createDashboardWidget(
  catalog: DashboardCatalog,
  type: WidgetType
): DashboardWidget {
  const source =
    catalog.sources.find((entry) => supportsType(entry, type)) ??
    catalog.sources[0]
  if (!source) throw new Error('Dashboard catalog has no sources')
  const measure = source.measures[0]
  const groups = groupByOptionsFor(source, type)
  const group =
    type === 'line'
      ? (groups.find((entry) => entry.temporal) ?? null)
      : type === 'donut'
        ? (groups.find((entry) => !entry.temporal) ?? null)
        : (groups[0] ?? null)
  const ranges =
    type === 'kpi'
      ? source.dateRanges
      : group?.temporal
        ? group.allowedRanges
        : source.dateRanges
  const dateRange = preferredRange(ranges)
  return normalizeWidget(
    {
      id: crypto.randomUUID(),
      type,
      title: measure?.label ?? 'New card',
      // Sensible starting size only; the sheet edits the native columns and rows.
      x: 0,
      y: 0,
      w: type === 'kpi' ? 1 : 2,
      h: type === 'kpi' ? 3 : 8,
      source: source.id,
      measure: measure?.id ?? '',
      groupBy: group?.id ?? null,
      seriesBy: null,
      dateRange: dateRange as DashboardWidget['dateRange'],
      filters: { statuses: [] },
    },
    catalog
  )
}

/** Client mirror of the server's strict combination rules. */
export function widgetValidationError(
  widget: DashboardWidget,
  catalog: DashboardCatalog
): string | null {
  if (widget.title.trim().length === 0) return 'Enter a card title.'
  if (widget.title.length > 80) return 'Titles are limited to 80 characters.'
  const source = findSource(catalog, widget.source)
  if (!source) return 'Choose a data source.'
  if (!source.types.includes(widget.type))
    return 'This visual type is not available for that source.'
  if (!source.measures.some((entry) => entry.id === widget.measure))
    return 'Choose a measure.'
  const group = findGroupBy(source, widget.groupBy)
  if (widget.type === 'kpi') {
    if (widget.groupBy !== null) return 'A KPI cannot have a grouping axis.'
  } else {
    if (!group) return 'Choose a grouping.'
    if (!group.allowedTypes.includes(widget.type))
      return 'This grouping does not support that visual type.'
    if (widget.type === 'line' && !group.temporal)
      return 'A line chart requires a time grouping.'
    if (widget.type === 'donut' && group.temporal)
      return 'A donut chart requires a categorical grouping.'
  }
  if (source.dateBasis === null) {
    if (widget.dateRange !== null)
      return 'Current stock is a snapshot with no date range.'
  } else {
    if (widget.dateRange === null) return 'Choose a date range.'
    const options = group?.temporal ? group.allowedRanges : source.dateRanges
    if (!options.includes(widget.dateRange))
      return 'That date range is not available for the selected grouping.'
  }
  if (widget.seriesBy === 'status' && !canSplitByStatus(source, widget, group))
    return 'Status series are only available on temporal line or column charts.'
  const filter = statusFilter(source)
  if (!filter) {
    if (widget.filters.statuses.length > 0)
      return 'Status filters are not available for this source.'
  } else {
    if (
      new Set(widget.filters.statuses).size !== widget.filters.statuses.length
    )
      return 'Choose each status once.'
    if (
      widget.filters.statuses.some(
        (status) => !filter.options.some((option) => option.value === status)
      )
    )
      return 'Choose only supported purchase order statuses.'
  }
  if (
    !Number.isInteger(widget.x) ||
    widget.x < 0 ||
    widget.x >= dashboardGridColumns
  )
    return 'Choose a starting column.'
  if (!Number.isSafeInteger(widget.y) || widget.y < 0)
    return 'Choose a starting row.'
  if (!Number.isInteger(widget.w) || widget.w < 1)
    return 'A card needs at least one column.'
  if (!Number.isSafeInteger(widget.h) || widget.h < 1)
    return 'A card needs a positive whole number of rows.'
  if (!Number.isSafeInteger(widget.y + widget.h))
    return 'That card size is too large to place.'
  if (widget.x + widget.w > dashboardGridColumns)
    return `A card must fit inside the ${dashboardGridColumns} columns.`
  return null
}

/**
 * Data-relevant batch signature for the query key. Title and layout changes do
 * not refetch; reordering does not either because results are keyed by id.
 */
export function dashboardDataSignature(widgets: DashboardWidget[]) {
  return JSON.stringify(
    widgets
      .map((widget) => ({
        id: widget.id,
        type: widget.type,
        source: widget.source,
        measure: widget.measure,
        groupBy: widget.groupBy,
        seriesBy: widget.seriesBy,
        dateRange: widget.dateRange,
        statuses: [...widget.filters.statuses].sort(
          (left, right) => left - right
        ),
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
  )
}

function canonicalWidget(widget: DashboardWidget) {
  return JSON.stringify({
    id: widget.id,
    type: widget.type,
    title: widget.title,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.h,
    source: widget.source,
    measure: widget.measure,
    groupBy: widget.groupBy,
    seriesBy: widget.seriesBy,
    dateRange: widget.dateRange,
    statuses: [...widget.filters.statuses].sort((left, right) => left - right),
  })
}

export function definitionsEqual(
  left: DashboardWidget[],
  right: DashboardWidget[]
) {
  return (
    left.length === right.length &&
    left.every((widget, index) => {
      const other = right[index]
      return (
        other !== undefined &&
        canonicalWidget(widget) === canonicalWidget(other)
      )
    })
  )
}
