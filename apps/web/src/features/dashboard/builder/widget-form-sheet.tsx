import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  canSplitByStatus,
  dateRangeOptionsFor,
  groupByOptionsFor,
  normalizeWidget,
  statusFilter,
  widgetValidationError,
} from './definition'
import { anchoredColumn, widgetPixelHeight } from './grid'
import {
  dashboardGridColumns,
  type DashboardBuilderScope,
  type DashboardCatalog,
  type DashboardWidget,
  type DashboardWidgetResult,
  type WidgetType,
} from './model'
import { dashboardDataQueryOptions } from './queries'
import { WidgetVisualization } from './widget-visualization'

export function WidgetFormSheet({
  scope,
  catalog,
  widget,
  mode,
  placementError,
  onCancel,
  onSave,
}: {
  scope: DashboardBuilderScope
  catalog: DashboardCatalog
  widget: DashboardWidget
  mode: 'new' | 'edit'
  placementError: string | null
  onCancel: () => void
  onSave: (widget: DashboardWidget) => void
}) {
  const [draft, setDraft] = useState(widget)
  const titleId = useId()
  const widthId = useId()
  const heightId = useId()
  const validation = widgetValidationError(draft, catalog)
  const preview = useQuery(
    dashboardDataQueryOptions(scope, [draft], validation === null)
  )
  const result: DashboardWidgetResult | undefined = preview.data?.results.find(
    (entry) => entry.id === draft.id
  )
  const source =
    catalog.sources.find((entry) => entry.id === draft.source) ??
    catalog.sources[0]
  const group =
    (draft.groupBy &&
      source?.groupBys.find((entry) => entry.id === draft.groupBy)) ||
    null
  const groups = source ? groupByOptionsFor(source, draft.type) : []
  const ranges = source ? dateRangeOptionsFor(catalog, source, group) : []
  const statuses = source ? statusFilter(source) : null

  function update(next: Partial<DashboardWidget>, allowSourceChange = false) {
    setDraft((current) => {
      const normalized = normalizeWidget(
        { ...current, ...next },
        catalog,
        allowSourceChange
      )
      // A width change keeps the card inside the four columns exactly as the
      // save path does, so the preview always describes a placeable card.
      return { ...normalized, x: anchoredColumn(current, normalized.w) }
    })
  }

  // Four columns is the physical grid width; rows are any positive whole
  // number and are only checked for safe-integer precision.
  function updateColumns(value: string) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return
    update({
      w: Math.min(Math.max(Math.trunc(parsed), 1), dashboardGridColumns),
    })
  }

  function updateRows(value: string) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return
    update({ h: Math.max(Math.trunc(parsed), 1) })
  }

  function save() {
    if (validation) return
    onSave(draft)
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <SheetContent className='flex w-full flex-col gap-0 sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>{mode === 'new' ? 'Add card' : 'Edit card'}</SheetTitle>
          <SheetDescription>
            Choose a supported source, measure and visual type, then set the
            card&apos;s grid columns and rows. The preview uses the real
            aggregates before you save the card.
          </SheetDescription>
        </SheetHeader>
        <div className='flex-1 space-y-5 overflow-y-auto px-4 pb-4'>
          <div className='space-y-2'>
            <Label htmlFor={titleId}>Title</Label>
            <Input
              id={titleId}
              value={draft.title}
              maxLength={80}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label>Visual type</Label>
              <Select
                value={draft.type}
                onValueChange={(value) =>
                  update({ type: value as WidgetType }, true)
                }
              >
                <SelectTrigger className='w-full' aria-label='Visual type'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {catalog.widgetTypes
                    .filter((option) => source?.types.includes(option.id))
                    .map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label>Data source</Label>
              <Select
                value={draft.source}
                onValueChange={(value) =>
                  update({ source: value as DashboardWidget['source'] })
                }
              >
                <SelectTrigger className='w-full' aria-label='Data source'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {catalog.sources.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label>Measure</Label>
              <Select
                value={draft.measure}
                onValueChange={(value) => update({ measure: value })}
              >
                <SelectTrigger className='w-full' aria-label='Measure'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {source?.measures.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {draft.type !== 'kpi' ? (
              <div className='space-y-2'>
                <Label>Grouping</Label>
                <Select
                  value={draft.groupBy ?? undefined}
                  onValueChange={(value) => update({ groupBy: value })}
                  disabled={groups.length === 0}
                >
                  <SelectTrigger className='w-full' aria-label='Grouping'>
                    <SelectValue placeholder='Select a grouping' />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {source && source.dateBasis === null ? (
              <p className='self-end text-xs text-muted-foreground sm:col-span-2'>
                Current stock is a live snapshot; no date range applies.
              </p>
            ) : (
              <div className='space-y-2'>
                <Label>Date range</Label>
                <Select
                  value={draft.dateRange ?? undefined}
                  onValueChange={(value) =>
                    update({
                      dateRange: value as DashboardWidget['dateRange'],
                    })
                  }
                >
                  <SelectTrigger className='w-full' aria-label='Date range'>
                    <SelectValue placeholder='Select a date range' />
                  </SelectTrigger>
                  <SelectContent>
                    {ranges.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {source && canSplitByStatus(source, draft, group) ? (
              <div className='space-y-2'>
                <Label>Split series</Label>
                <Select
                  value={draft.seriesBy ?? 'none'}
                  onValueChange={(value) =>
                    update({
                      seriesBy: value === 'status' ? 'status' : null,
                    })
                  }
                >
                  <SelectTrigger className='w-full' aria-label='Split series'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='none'>Single series</SelectItem>
                    {source.series.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className='space-y-2'>
              <Label htmlFor={widthId}>Width (columns)</Label>
              <Input
                id={widthId}
                type='number'
                inputMode='numeric'
                min={1}
                max={dashboardGridColumns}
                step={1}
                value={draft.w}
                onChange={(event) => updateColumns(event.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor={heightId}>Height (rows)</Label>
              <Input
                id={heightId}
                type='number'
                inputMode='numeric'
                min={1}
                step={1}
                value={draft.h}
                onChange={(event) => updateRows(event.target.value)}
              />
            </div>
            <p className='text-xs text-muted-foreground sm:col-span-2'>
              Cards sit on a four-column grid. Width is a column count and
              height is any whole number of rows; a wider card keeps its right
              edge on the grid.
            </p>
          </div>

          {statuses ? (
            <fieldset className='space-y-2'>
              <legend className='text-sm font-medium'>{statuses.label}</legend>
              <p className='text-xs text-muted-foreground'>
                Leave every option unchecked to include all statuses.
              </p>
              <div className='grid gap-2 sm:grid-cols-2'>
                {statuses.options.map((option) => (
                  <label
                    key={option.value}
                    className='flex items-center gap-2 text-sm'
                  >
                    <Checkbox
                      checked={draft.filters.statuses.includes(option.value)}
                      onCheckedChange={(checked) =>
                        update({
                          filters: {
                            statuses:
                              checked === true
                                ? [...draft.filters.statuses, option.value]
                                : draft.filters.statuses.filter(
                                    (status) => status !== option.value
                                  ),
                          },
                        })
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <section
            aria-label='Card preview'
            className='space-y-2 rounded-md border border-border p-3'
          >
            <h3 className='text-sm font-medium'>Preview</h3>
            {validation ? (
              <p role='alert' className='text-sm text-destructive'>
                {validation}
              </p>
            ) : (
              // Definite, finite preview box matching the persisted size: the
              // column fraction for width and the exact row height in pixels.
              <div
                className='flex min-h-0 flex-col overflow-auto'
                style={{
                  width: `${(draft.w / dashboardGridColumns) * 100}%`,
                  height: widgetPixelHeight(draft),
                }}
              >
                <WidgetVisualization
                  widget={draft}
                  result={result}
                  pending={preview.isPending}
                  error={preview.isError ? preview.error : null}
                  onRetry={() => void preview.refetch()}
                />
              </div>
            )}
          </section>

          {placementError ? (
            <p role='alert' className='text-sm text-destructive'>
              {placementError}
            </p>
          ) : null}
        </div>
        <SheetFooter className='flex-row justify-end gap-2 border-t border-border'>
          <Button type='button' variant='outline' onClick={onCancel}>
            Cancel
          </Button>
          <Button type='button' onClick={save} disabled={validation !== null}>
            Save card
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
