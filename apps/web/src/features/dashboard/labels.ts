import { t } from '@/lib/i18n'
import type {
  DashboardDateRangeId,
  DashboardGranularity,
  DashboardSourceId,
  DashboardWidget,
  DashboardWidgetResult,
  WidgetType,
} from './builder/model'
import { dayMonthLabel, monthYearLabel } from './format'

/**
 * The server catalog and the aggregate results carry English display labels
 * next to stable identifiers. Every helper below maps an identifier to the
 * display text and falls back to the server label, so widget state, persisted
 * definitions and submitted values stay exactly what the API returned.
 */
function text(key: string, fallback: string) {
  return t(key, { defaultValue: fallback })
}

export function widgetTypeLabel(id: WidgetType, label: string) {
  return text(`dashboard:widgetTypes.${id}`, label)
}

export function sourceLabel(id: DashboardSourceId, label: string) {
  return text(`dashboard:sources.${id}`, label)
}

export function measureLabel(
  source: DashboardSourceId,
  measure: string,
  label: string
) {
  return text(`dashboard:measures.${source}.${measure}.label`, label)
}

export function measureUnitLabel(
  source: DashboardSourceId,
  measure: string,
  unitLabel: string
) {
  return text(`dashboard:measures.${source}.${measure}.unit`, unitLabel)
}

export function groupByLabel(id: string, label: string) {
  return text(`dashboard:groupBys.${id}`, label)
}

export function dateRangeLabel(id: DashboardDateRangeId, label: string) {
  return text(`dashboard:dateRanges.${id}`, label)
}

export function dateBasisLabel(source: DashboardSourceId, dateBasis: string) {
  return text(`dashboard:dateBasis.${source}`, dateBasis)
}

export function catalogSeriesLabel(id: 'status', label: string) {
  return text(`dashboard:series.${id}`, label)
}

export function catalogFilterLabel(id: 'statuses', label: string) {
  return text(`dashboard:filters.${id}`, label)
}

/** One native purchase-order status, keyed by its numeric value. */
export function statusLabel(value: number, label: string) {
  return text(`dashboard:statuses.${value}`, label)
}

const monthKeyPattern = /^(\d{4})-(\d{2})$/
const dayKeyPattern = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Temporal bucket keys are the server's own `YYYY-MM-DD` day and week starts or
 * `YYYY-MM` months, so the axis label is rebuilt from the key; the English
 * label text is only a fallback for an unexpected shape.
 */
function temporalCategoryLabel(
  key: string,
  granularity: DashboardGranularity | null,
  label: string
) {
  const day = dayKeyPattern.exec(key)
  if (day) {
    const date = dayMonthLabel(Number(day[2]) - 1, Number(day[3]))
    return granularity === 'week'
      ? t('dashboard:common.weekOf', { date })
      : date
  }
  const month = monthKeyPattern.exec(key)
  if (month) return monthYearLabel(Number(month[2]) - 1, Number(month[1]))
  return label
}

const groupKeyPrefix = 'group:'

/**
 * One axis label resolved from its response metadata key. The API reserves
 * `total`, `__other__` and the date-keyed temporal buckets, and prefixes every
 * stored group key with `group:` (empty for a missing supplier or category).
 * Only those encodings are translated; the raw part of a `group:` key is a
 * user record, so its label is returned verbatim.
 */
function categoryText(
  widget: DashboardWidget,
  result: DashboardWidgetResult,
  label: string,
  key: string | undefined
) {
  if (key === undefined) return label
  if (result.temporal)
    return temporalCategoryLabel(key, result.granularity, label)
  if (key === '__other__') return t('dashboard:common.other')
  if (key === 'total')
    return widget.groupBy === null ? t('dashboard:common.total') : label
  if (!key.startsWith(groupKeyPrefix)) return label
  const rawKey = key.slice(groupKeyPrefix.length)
  if (rawKey === '') {
    if (widget.source === 'purchases' && widget.groupBy === 'supplier')
      return t('dashboard:common.noSupplier')
    if (widget.source === 'stock' && widget.groupBy === 'category')
      return t('dashboard:common.uncategorized')
    return label
  }
  if (
    widget.source === 'purchases' &&
    widget.groupBy === 'status' &&
    /^\d+$/.test(rawKey)
  )
    return statusLabel(Number(rawKey), label)
  return label
}

function seriesText(
  series: { key: string; label: string },
  measure: string
): string {
  if (series.key === 'value' || series.key === 'total') return measure
  if (/^\d+$/.test(series.key))
    return statusLabel(Number(series.key), series.label)
  return series.label
}

/**
 * Presentation copy of one aggregate result: only the display labels change.
 * `widget` supplies the source, measure and grouping that the response labels
 * were derived from; totals, values, keys, category keys and dates stay
 * untouched.
 */
export function localizeResult(
  widget: DashboardWidget,
  result: DashboardWidgetResult
): DashboardWidgetResult {
  const measure = measureLabel(
    widget.source,
    result.measure,
    result.measureLabel
  )
  return {
    ...result,
    measureLabel: measure,
    unitLabel: measureUnitLabel(
      widget.source,
      result.measure,
      result.unitLabel
    ),
    rangeLabel:
      result.rangeLabel === null || widget.dateRange === null
        ? result.rangeLabel
        : dateRangeLabel(widget.dateRange, result.rangeLabel),
    dateBasis:
      result.dateBasis === null
        ? null
        : dateBasisLabel(widget.source, result.dateBasis),
    categories: result.categories.map((label, index) => {
      const key: string | undefined = result.categoryKeys[index]
      return categoryText(widget, result, label, key)
    }),
    series: result.series.map((series) => ({
      ...series,
      label: seriesText(series, measure),
    })),
  }
}
