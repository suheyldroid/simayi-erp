import { useId } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export type ActivitySeries = {
  key: string
  label: string
  /** CSS color reference, e.g. `var(--chart-1)`. */
  color: string
  /** One value per month label, aligned by index. */
  values: number[]
}

/**
 * Grouped bar chart for real monthly counts. Recharts draws the plot and its
 * native tooltip; the tooltip lists every series for the hovered or
 * keyboard-selected month, including zero counts. The caption text, legend and
 * the numeric table below stay the canonical accessible form.
 */
export function ActivityChart({
  title,
  description,
  monthLabels,
  series,
  emptyMessage,
}: {
  title: string
  description: string
  monthLabels: string[]
  series: ActivitySeries[]
  emptyMessage: string
}) {
  const titleId = useId()
  const descriptionId = useId()
  const highest = series.reduce(
    (max, entry) => Math.max(max, ...entry.values),
    0
  )
  const hasActivity = monthLabels.length > 0 && highest > 0
  const data = monthLabels.map((label, monthIndex) => {
    const point: Record<string, string | number> = { month: label }
    for (const entry of series) {
      point[entry.key] = entry.values[monthIndex] ?? 0
    }
    return point
  })

  return (
    <Card className='rounded-md shadow-none'>
      <CardHeader className='gap-1'>
        <CardTitle id={titleId} className='text-base'>
          {title}
        </CardTitle>
        <CardDescription id={descriptionId}>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <figure
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className='space-y-3'
        >
          {hasActivity ? (
            <>
              <ul className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground'>
                {series.map((entry) => (
                  <li key={entry.key} className='flex items-center gap-1.5'>
                    <span
                      aria-hidden='true'
                      className='size-2.5 shrink-0 rounded-sm'
                      style={{ backgroundColor: entry.color }}
                    />
                    {entry.label}
                  </li>
                ))}
              </ul>
              <ResponsiveContainer width='100%' aspect={2}>
                <BarChart
                  data={data}
                  title={title}
                  barCategoryGap='20%'
                  barGap={2}
                  margin={{ top: 8, right: 10, bottom: 0, left: 0 }}
                >
                  <CartesianGrid vertical={false} stroke='var(--border)' />
                  <XAxis
                    dataKey='month'
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)', fillOpacity: 0.4 }}
                    formatter={(value, name) => [
                      Number(value).toLocaleString(),
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      color: 'var(--popover-foreground)',
                      fontSize: 12,
                    }}
                  />
                  {series.map((entry) => (
                    <Bar
                      key={entry.key}
                      dataKey={entry.key}
                      name={entry.label}
                      fill={entry.color}
                      radius={[2, 2, 0, 0]}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <details className='text-xs text-muted-foreground'>
                <summary className='w-fit cursor-pointer rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'>
                  View monthly values
                </summary>
                <div className='mt-2 overflow-x-auto'>
                  <table className='w-full border-collapse text-left'>
                    <caption className='sr-only'>
                      {title} monthly values
                    </caption>
                    <thead>
                      <tr className='border-b border-border'>
                        <th scope='col' className='py-1 pe-3 font-medium'>
                          Month
                        </th>
                        {series.map((entry) => (
                          <th
                            key={entry.key}
                            scope='col'
                            className='py-1 pe-3 font-medium'
                          >
                            {entry.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthLabels.map((label, monthIndex) => (
                        <tr
                          key={`${label}-${monthIndex}`}
                          className='border-b border-border/60 last:border-b-0'
                        >
                          <th scope='row' className='py-1 pe-3 font-normal'>
                            {label}
                          </th>
                          {series.map((entry) => (
                            <td
                              key={entry.key}
                              className='py-1 pe-3 tabular-nums'
                            >
                              {entry.values[monthIndex] ?? 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <p className='text-sm text-muted-foreground'>{emptyMessage}</p>
          )}
        </figure>
      </CardContent>
    </Card>
  )
}
