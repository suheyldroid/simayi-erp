import { memo, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { DragDropProvider, useDragDropManager } from '@dnd-kit/react'
import { verticalCompactor } from '@snapgridjs/core'
import {
  GridItem,
  GridPlaceholder,
  useContainerWidth,
  useGridContainer,
  type Layout,
} from '@snapgridjs/react'
import { Pencil, Trash2 } from 'lucide-react'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  dashboardGridConfig,
  dashboardPositionParams,
  dashboardResizeHandles,
  gridColumnPitch,
  gridRowUnit,
  gridSurfaceHeight,
  gridSurfacePadding,
  layoutForWidgets,
  occupiedRows,
  placementChanged,
  readingOrder,
  widgetPixelHeight,
  widgetPixelRect,
  widgetsFromLayout,
} from './grid'
import { TooltipIconButton } from './icon-button'
import { type DashboardWidget, type DashboardWidgetResult } from './model'
import { WidgetCard } from './widget-card'

interface GridProps {
  widgets: DashboardWidget[]
  editing: boolean
  busy: boolean
  canEdit: boolean
  results: Map<string, DashboardWidgetResult>
  pending: boolean
  error: unknown
  onRetry: () => void
  onLayoutChange: (widgets: DashboardWidget[]) => void
  onEdit: (widget: DashboardWidget) => void
  onRemove: (widget: DashboardWidget) => void
}

interface CardProps {
  widgets: DashboardWidget[]
  results: Map<string, DashboardWidgetResult>
  pending: boolean
  error: unknown
  onRetry: () => void
}

/**
 * Checkerboard + hatch backdrop drawn behind the cards while editing. Its cell
 * pitch comes from the same column width and gap SnapGrid positions the cards
 * with, so a guide cell and a card cell line up instead of the guide drifting by
 * the gap. The caller insets the element to the canvas padding, so the backdrop
 * covers exactly the cells the cards occupy.
 */
function guidePattern(width: number) {
  const columnPitch = gridColumnPitch(width)
  return {
    backgroundImage:
      'repeating-conic-gradient(from 0deg, color-mix(in oklab, var(--muted) 55%, transparent) 0% 25%, transparent 0% 50%), repeating-linear-gradient(135deg, color-mix(in oklab, var(--border) 45%, transparent) 0 1px, transparent 1px 10px)',
    backgroundSize: `${columnPitch * 2}px ${gridRowUnit * 2}px, auto`,
  }
}

/**
 * The whole tile is the pointer drag surface, except for real controls: a
 * pointer-down on any of these never starts a move, so chart/table actions and
 * the card's Edit/Remove buttons keep working. `[role="button"]` is deliberately
 * absent — the tile itself carries that role and would cancel every drag.
 */
const dragCancelSelector =
  'button, a, input, select, textarea, summary, label, [contenteditable="true"], [role="menuitem"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"]'

/**
 * Read-only desktop layout. Positions and the canvas height come from SnapGrid's
 * own geometry for the same grid config the editor uses, so view mode keeps the
 * saved coordinates without mounting any drag sensors or touch handlers, and its
 * canvas matches the editor's canvas for the same rows.
 */
function DashboardStaticGrid({
  widgets,
  results,
  pending,
  error,
  onRetry,
}: CardProps) {
  const { width, mounted, containerRef } = useContainerWidth()
  const positionParams = useMemo(() => dashboardPositionParams(width), [width])
  const placed = readingOrder(widgets).map((widget) => ({
    widget,
    rect: widgetPixelRect(widget, positionParams),
  }))
  const height = gridSurfaceHeight(occupiedRows(widgets))

  return (
    <div
      ref={containerRef}
      className='relative'
      style={{ height: mounted ? height : 0 }}
    >
      {mounted
        ? placed.map(({ widget, rect }) => (
            <div
              key={widget.id}
              style={{
                position: 'absolute',
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
              }}
            >
              <WidgetCard
                widget={widget}
                result={results.get(widget.id)}
                pending={pending}
                error={error}
                onRetry={onRetry}
                editing={false}
              />
            </div>
          ))
        : null}
    </div>
  )
}

/** Narrow-viewport view: cards stack in canonical y/x reading order. */
function DashboardCardStack({
  widgets,
  results,
  pending,
  error,
  onRetry,
}: CardProps) {
  return (
    <div
      role='group'
      aria-label={t('dashboard:grid.cards')}
      className='space-y-3'
    >
      {readingOrder(widgets).map((widget) => (
        <div key={widget.id} style={{ height: widgetPixelHeight(widget) }}>
          <WidgetCard
            widget={widget}
            result={results.get(widget.id)}
            pending={pending}
            error={error}
            onRetry={onRetry}
            editing={false}
          />
        </div>
      ))}
    </div>
  )
}

/**
 * SnapGrid is the single drag, resize and reflow engine for the dashboard.
 * The persisted definition stays the source of truth: the grid receives the
 * cards as a controlled layout and commits placements only when a gesture ends
 * normally (`onLayoutChange` fires on commit, never while dragging, on mount or
 * on a viewport change). The compactor is the library's own vertical reflow, so
 * neighbours move out of the way instead of rejecting the gesture, and the
 * committed `x`, `y`, `w` and `h` are transferred exactly — no snapping or
 * clamping — so the saved geometry matches what the user saw.
 */
function DashboardGridSurface({
  widgets,
  busy,
  canEdit,
  width,
  results,
  pending,
  error,
  onRetry,
  onLayoutChange,
  onEdit,
  onRemove,
}: Omit<GridProps, 'editing'> & { width: number }) {
  const manager = useDragDropManager()
  const layout = useMemo(() => layoutForWidgets(widgets), [widgets])
  const interactive = !busy

  const commit = useCallback(
    (next: Layout) => {
      const committed = widgetsFromLayout(widgets, next)
      if (!committed || !placementChanged(widgets, committed)) return
      onLayoutChange(committed)
    },
    [widgets, onLayoutChange]
  )

  const { containerProps, group } = useGridContainer({
    width,
    layout,
    onLayoutChange: commit,
    gridConfig: dashboardGridConfig,
    compactor: verticalCompactor,
    dragConfig: { cancel: dragCancelSelector },
    resizeConfig: { handles: [...dashboardResizeHandles] },
    isDraggable: interactive,
    isResizable: interactive,
  })

  // Opening the card form or starting a save must never leave a sensor preview
  // behind; dnd-kit's cancel path drops the preview and skips the commit
  // callbacks, so no layout is persisted from the abandoned gesture.
  useEffect(() => {
    if (interactive || !manager) return
    const { status } = manager.dragOperation
    if (status.idle || status.dropped) return
    manager.actions.stop({ canceled: true })
  }, [interactive, manager])

  // A card can only be dropped while the pointer is over the surface, so the
  // drop target has to extend past the last occupied row. Both the content
  // height and that extra row come from the same canvas contract, so the
  // editor's canvas is the view's canvas plus exactly one row instead of an
  // independently invented height.
  const rows = occupiedRows(widgets) + 1

  return (
    <div
      {...containerProps}
      className='select-none'
      style={{
        ...containerProps.style,
        // The measured canvas and this surface are one box: the surface fills the
        // element that was measured instead of copying the measurement into an
        // in-flow child, so no wrapper can widen the grid past its container.
        width: '100%',
        minHeight: gridSurfaceHeight(rows),
      }}
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute'
        style={{
          ...guidePattern(width),
          top: gridSurfacePadding[1],
          left: gridSurfacePadding[0],
          right: gridSurfacePadding[0],
          bottom: gridSurfacePadding[1],
        }}
      />
      <GridPlaceholder group={group} />
      {readingOrder(widgets).map((widget) => (
        // The library's native tile is created here, on every surface render,
        // and not inside the memoized card below: `useGridItem` reads the grid's
        // measured width from the controller config while it renders, and the
        // config is replaced without notifying item subscribers, so a memoized
        // item would keep the geometry of whatever width it first rendered with
        // (the 1280px seed, or the width before a sidebar change). Rendering it
        // here makes every width/layout change reach the tile's inline
        // left/top/width/height without remounting it. The card content stays
        // memoized, so a drag's preview re-renders only the cheap wrappers.
        <GridItem key={widget.id} id={widget.id} group={group}>
          <DashboardTile
            widget={widget}
            busy={busy}
            canEdit={canEdit}
            result={results.get(widget.id)}
            pending={pending}
            error={error}
            onRetry={onRetry}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        </GridItem>
      ))}
    </div>
  )
}

/**
 * Edit host: measures the canvas, supplies the dnd-kit provider so
 * `useGridContainer` always runs inside it, and keeps the four-column canvas at
 * a usable width inside a horizontally scrollable region on a narrow viewport
 * instead of rewriting saved positions.
 *
 * The grid itself mounts only once the canvas has a measured width: the library
 * seeds `useContainerWidth` with 1280px, and rendering the surface at that seed
 * lays every card out for a width the canvas does not have, then corrects it a
 * frame later — a visible slide and overflow on entering edit mode. Waiting for
 * the measurement costs one pre-paint render and never shows the seed geometry.
 */
function DashboardGridEditor(props: GridProps) {
  const isMobile = useIsMobile()
  const { width, mounted, containerRef } = useContainerWidth()
  const surfaceProps: Omit<GridProps, 'editing'> = props
  const canvas = (
    <div ref={containerRef} className={cn(isMobile && 'min-w-[56rem]')}>
      {mounted ? (
        <DragDropProvider>
          <DashboardGridSurface {...surfaceProps} width={width} />
        </DragDropProvider>
      ) : null}
    </div>
  )

  if (!isMobile) return canvas

  return (
    <div
      role='region'
      tabIndex={0}
      aria-label={t('dashboard:grid.editingRegion')}
      className='overflow-x-auto pb-2 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
    >
      {canvas}
    </div>
  )
}

/**
 * Spatial dashboard grid shared by view and edit modes. View mode renders the
 * saved coordinates without interaction; edit mode mounts SnapGrid, and a
 * viewport change never rewrites the saved positions.
 */
export function DashboardGrid(props: GridProps) {
  const isMobile = useIsMobile()

  if (props.editing) return <DashboardGridEditor {...props} />
  if (isMobile) return <DashboardCardStack {...props} />
  return <DashboardStaticGrid {...props} />
}

/**
 * One dashboard card's content, rendered inside the surface-created `GridItem`.
 * The card is memoized on its own data and handlers, so a drag preview or a
 * width change re-renders only the native tile wrapper; Edit/Remove stay
 * ordinary buttons because the surface's cancel selector keeps real controls
 * out of the drag.
 */
const DashboardTile = memo(function DashboardTile({
  widget,
  busy,
  canEdit,
  result,
  pending,
  error,
  onRetry,
  onEdit,
  onRemove,
}: {
  widget: DashboardWidget
  busy: boolean
  canEdit: boolean
  result?: DashboardWidgetResult
  pending: boolean
  error: unknown
  onRetry: () => void
  onEdit: (widget: DashboardWidget) => void
  onRemove: (widget: DashboardWidget) => void
}) {
  const actions: ReactNode = (
    <>
      <TooltipIconButton
        label={t('dashboard:grid.editLabel', { title: widget.title })}
        tooltip={t('dashboard:grid.editTooltip')}
        disabled={busy || !canEdit}
        onClick={() => onEdit(widget)}
      >
        <Pencil aria-hidden='true' />
      </TooltipIconButton>
      <TooltipIconButton
        label={t('dashboard:grid.removeLabel', { title: widget.title })}
        tooltip={t('dashboard:grid.removeTooltip')}
        disabled={busy}
        onClick={() => onRemove(widget)}
      >
        <Trash2 aria-hidden='true' />
      </TooltipIconButton>
    </>
  )

  return (
    <WidgetCard
      widget={widget}
      result={result}
      pending={pending}
      error={error}
      onRetry={onRetry}
      editing
      actions={actions}
    />
  )
})
