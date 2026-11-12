import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { DashboardWidget, DashboardWidgetResult } from './model'
import { WidgetVisualization } from './widget-visualization'

/**
 * One dashboard card. The SnapGrid tile owns the whole-card drag interaction
 * and its native resize handles; this card only draws the header actions and
 * the visualization, so Edit/Remove stay ordinary buttons.
 */
export function WidgetCard({
  widget,
  result,
  pending,
  error,
  onRetry,
  editing,
  actions,
}: {
  widget: DashboardWidget
  result?: DashboardWidgetResult
  pending: boolean
  error: unknown
  onRetry: () => void
  editing: boolean
  actions?: ReactNode
}) {
  return (
    <Card className='relative h-full min-w-0 gap-0 overflow-hidden rounded-md py-0 shadow-none'>
      <CardHeader
        className={cn(
          'flex flex-row items-start gap-2 border-b border-border/60 px-3',
          widget.type === 'kpi' ? 'py-1.5' : 'py-2'
        )}
      >
        <div className='min-w-0 flex-1'>
          <CardTitle
            role='heading'
            aria-level={2}
            className='line-clamp-2 text-sm font-semibold break-words'
          >
            {widget.title}
          </CardTitle>
          <CardDescription className='truncate text-[11px]'>
            {result?.measureLabel ?? ''}
            {editing && result?.measureLabel ? ' · ' : null}
            {editing ? `column ${widget.x + 1}, row ${widget.y + 1}` : null}
          </CardDescription>
        </div>
        {actions ? (
          <div className='flex shrink-0 items-center gap-0.5'>{actions}</div>
        ) : null}
      </CardHeader>
      <CardContent
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-y-auto px-3',
          widget.type === 'kpi' ? 'gap-1 py-1.5' : 'gap-2 py-2'
        )}
      >
        <WidgetVisualization
          widget={widget}
          result={result}
          pending={pending}
          error={error}
          onRetry={onRetry}
        />
        {result ? (
          <p className='mt-auto shrink-0 text-[11px] text-muted-foreground'>
            {result.dateBasis ?? 'Current stock snapshot'} · as of{' '}
            {result.asOf.replace('T', ' ').slice(0, 16)} UTC
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
