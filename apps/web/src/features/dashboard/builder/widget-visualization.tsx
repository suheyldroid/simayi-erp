import { useId } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { formatCount } from '../format'
import { localizeResult } from '../labels'
import { errorMessage } from './api'
import type { DashboardWidget, DashboardWidgetResult } from './model'

const palette = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

/**
 * Plot region fills the card's native grid height but never dictates it: the
 * persisted row height owns the box, and a card shorter than its content
 * scrolls inside the card instead of forcing a minimum plot size.
 */
const plotClass = 'w-full min-h-0 flex-1'

function chartData(result: DashboardWidgetResult) {
  return result.categories.map((label, index) => {
    const point: Record<string, string | number> = { label }
    for (const series of result.series)
      point[series.key] = series.values[index] ?? 0
    return point
  })
}

function tooltipProps() {
  return {
    formatter: (value: unknown, name: unknown) =>
      [
        formatCount(Number(value)),
        typeof name === 'string' ? name : String(name),
      ] as [string, string],
    contentStyle: {
      backgroundColor: 'var(--popover)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      color: 'var(--popover-foreground)',
      fontSize: 12,
    },
  }
}

function SeriesLegend({ result }: { result: DashboardWidgetResult }) {
  if (result.series.length === 0) return null
  return (
    <ul className='flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground'>
      {result.series.map((series, index) => (
        <li key={series.key} className='flex items-center gap-1.5'>
          <span
            aria-hidden='true'
            className='size-2.5 shrink-0 rounded-sm'
            style={{ backgroundColor: palette[index % palette.length] }}
          />
          {series.label}
        </li>
      ))}
    </ul>
  )
}

function DataTable({
  title,
  result,
}: {
  title: string
  result: DashboardWidgetResult
}) {
  if (result.categories.length === 0) return null
  return (
    <details className='shrink-0 text-xs text-muted-foreground'>
      <summary className='w-fit cursor-pointer rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'>
        {t('dashboard:visualization.viewDataTable')}
      </summary>
      <div className='mt-2 max-h-64 overflow-auto'>
        <table className='w-full border-collapse text-left'>
          <caption className='sr-only'>
            {t('dashboard:visualization.dataTableCaption', { title })}
          </caption>
          <thead>
            <tr className='border-b border-border'>
              <th scope='col' className='py-1 pe-3 font-medium'>
                {t('dashboard:visualization.category')}
              </th>
              {result.series.map((series) => (
                <th
                  key={series.key}
                  scope='col'
                  className='py-1 pe-3 font-medium'
                >
                  {series.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.categories.map((label, index) => (
              <tr
                key={`${label}-${index}`}
                className='border-b border-border/60 last:border-b-0'
              >
                <th scope='row' className='py-1 pe-3 font-normal'>
                  {label}
                </th>
                {result.series.map((series) => (
                  <td key={series.key} className='py-1 pe-3 tabular-nums'>
                    {formatCount(series.values[index] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function CartesianChart({
  widget,
  result,
}: {
  widget: DashboardWidget
  result: DashboardWidgetResult
}) {
  const data = chartData(result)

  if (widget.type === 'line')
    return (
      <div className={plotClass}>
        <ResponsiveContainer width='100%' height='100%'>
          <LineChart
            data={data}
            margin={{ top: 8, right: 10, bottom: 0, left: 0 }}
          >
            <CartesianGrid vertical={false} stroke='var(--border)' />
            <XAxis
              dataKey='label'
              tickLine={false}
              axisLine={false}
              interval='preserveStartEnd'
              minTickGap={12}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            />
            <Tooltip {...tooltipProps()} />
            {result.series.map((series, index) => (
              <Line
                key={series.key}
                type='monotone'
                dataKey={series.key}
                name={series.label}
                stroke={palette[index % palette.length]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  if (widget.type === 'bar')
    return (
      <div className={plotClass}>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart
            layout='vertical'
            data={data}
            margin={{ top: 8, right: 10, bottom: 0, left: 0 }}
          >
            <CartesianGrid horizontal={false} stroke='var(--border)' />
            <XAxis
              type='number'
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            />
            <YAxis
              type='category'
              dataKey='label'
              width={104}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: 'var(--muted)', fillOpacity: 0.4 }}
              {...tooltipProps()}
            />
            {result.series.map((series, index) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                name={series.label}
                fill={palette[index % palette.length]}
                radius={[0, 2, 2, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  return (
    <div className={plotClass}>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart
          data={data}
          margin={{ top: 8, right: 10, bottom: 0, left: 0 }}
          barCategoryGap='20%'
          barGap={2}
        >
          <CartesianGrid vertical={false} stroke='var(--border)' />
          <XAxis
            dataKey='label'
            tickLine={false}
            axisLine={false}
            interval='preserveStartEnd'
            minTickGap={12}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', fillOpacity: 0.4 }}
            {...tooltipProps()}
          />
          {result.series.map((series, index) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.label}
              fill={palette[index % palette.length]}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function DonutChart({ result }: { result: DashboardWidgetResult }) {
  const series = result.series[0]
  const slices = result.categories.map((label, index) => ({
    name: label,
    value: series?.values[index] ?? 0,
  }))
  if (slices.length === 0) return null
  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <div className={plotClass}>
        <ResponsiveContainer width='100%' height='100%'>
          <PieChart>
            <Pie
              data={slices}
              dataKey='value'
              nameKey='name'
              innerRadius='55%'
              outerRadius='82%'
              isAnimationActive={false}
            >
              {slices.map((slice, index) => (
                <Cell
                  key={`${slice.name}-${index}`}
                  fill={palette[index % palette.length]}
                />
              ))}
            </Pie>
            <Tooltip {...tooltipProps()} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className='grid shrink-0 grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2'>
        {slices.map((slice, index) => (
          <li
            key={`${slice.name}-${index}`}
            className='flex items-center gap-1.5'
          >
            <span
              aria-hidden='true'
              className='size-2.5 shrink-0 rounded-sm'
              style={{ backgroundColor: palette[index % palette.length] }}
            />
            <span className='truncate'>{slice.name}</span>
            <span className='ms-auto tabular-nums'>
              {formatCount(slice.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Renders one real aggregate result. Loading, failure, empty and genuine zero
 * states stay distinct; a zero result is never presented as a failed request.
 */
export function WidgetVisualization({
  widget,
  result,
  pending,
  error,
  onRetry,
}: {
  widget: DashboardWidget
  result?: DashboardWidgetResult
  pending: boolean
  error: unknown
  onRetry?: () => void
}) {
  const titleId = useId()
  const descriptionId = useId()

  if (pending)
    return (
      <p role='status' className='text-sm text-muted-foreground'>
        {t('dashboard:visualization.loading')}
      </p>
    )
  if (error)
    return (
      <div role='alert' className='space-y-2'>
        <p className='text-sm'>
          {t('dashboard:visualization.error')} {errorMessage(error)}
        </p>
        {onRetry ? (
          <Button variant='outline' size='sm' onClick={onRetry}>
            {t('dashboard:common.retry')}
          </Button>
        ) : null}
      </div>
    )
  if (!result)
    return (
      <p className='text-sm text-muted-foreground'>
        {t('dashboard:visualization.noResult')}
      </p>
    )

  // Only display labels are localized; every value, key and date stays as the
  // API returned it.
  const view = localizeResult(widget, result)

  if (widget.type === 'kpi')
    return (
      <div className='space-y-1'>
        <p className='text-3xl font-semibold tabular-nums'>
          {formatCount(view.total)}
          <span className='ms-2 text-sm font-normal text-muted-foreground'>
            {view.unitLabel}
          </span>
        </p>
        <p id={descriptionId} className='text-xs text-muted-foreground'>
          {view.measureLabel}
          {view.rangeLabel
            ? ` · ${view.rangeLabel}`
            : ` · ${t('dashboard:common.currentSnapshot')}`}
        </p>
      </div>
    )

  if (view.categories.length === 0)
    return (
      <p className='text-sm text-muted-foreground'>
        {t('dashboard:visualization.noRecords')}
      </p>
    )

  return (
    <figure
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className='flex min-h-0 flex-1 flex-col gap-2'
    >
      <figcaption id={titleId} className='sr-only'>
        {widget.title}
      </figcaption>
      {view.series.length > 1 ? <SeriesLegend result={view} /> : null}
      {view.total === 0 ? (
        <p
          id={descriptionId}
          className='shrink-0 text-xs text-muted-foreground'
        >
          {t('dashboard:visualization.zeroNote')}
        </p>
      ) : (
        <p
          id={descriptionId}
          className='shrink-0 text-xs text-muted-foreground'
        >
          {formatCount(view.total)} {view.unitLabel}
          {view.rangeLabel ? ` · ${view.rangeLabel}` : ''}
        </p>
      )}
      {widget.type === 'donut' ? (
        <DonutChart result={view} />
      ) : (
        <CartesianChart widget={widget} result={view} />
      )}
      <DataTable title={widget.title} result={view} />
    </figure>
  )
}
