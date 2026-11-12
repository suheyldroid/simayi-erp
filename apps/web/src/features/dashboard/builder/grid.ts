import {
  calcGridColWidth,
  calcGridItemPosition,
  getAllCollisions,
  insertItemWithCompactor,
  resizeItemWithCompactor,
  toPositionParams,
  verticalCompactor,
  type GridConfig,
  type Layout,
  type LayoutItem,
  type PositionParams,
} from '@snapgridjs/core'
import { dashboardGridColumns, type DashboardWidget } from './model'

/**
 * Persisted four-column dashboard grid. A row unit is 48px including the card
 * gap, so SnapGrid places a card with `rowHeight` plus its margin on every row.
 */
export const gridRowUnit = 48
/** Card gap, in pixels. SnapGrid applies it as the margin between cards. */
export const gridCardGap = 8

const gridRowHeight = gridRowUnit - gridCardGap

/**
 * Canvas inset, in pixels (SnapGrid container padding). The surface is inset by
 * one gap on every side, so the gap between cards, the gap to the canvas edge
 * and the library's own resize handles (14px hit areas centred 7px outside each
 * edge) all follow one measure: an edge card's handles stay inside the canvas
 * instead of overhanging it, and a full-width card ends one gap short of the
 * canvas edge like every other gap.
 */
export const gridSurfacePadding: readonly [number, number] = [
  gridCardGap,
  gridCardGap,
]

/**
 * SnapGrid geometry for the dashboard surface. `maxRows` stays the library's
 * own unbounded extent (`Infinity`), so the engine imposes no row or column cap
 * of its own; the persisted values are checked as safe integers on both sides
 * instead of being compared against a separate engine bound. The only physical
 * limit is the four columns.
 */
export const dashboardGridConfig: GridConfig = {
  cols: dashboardGridColumns,
  rowHeight: gridRowHeight,
  margin: [gridCardGap, gridCardGap],
  containerPadding: gridSurfacePadding,
  maxRows: Number.POSITIVE_INFINITY,
}

/**
 * The resize axes the dashboard offers, from the library's documented set: the
 * south-east corner, the east and south edges (top-left anchored) and the west
 * edge (right edge anchored, which is how a right-hand card grows to full
 * width without leaving the grid).
 */
export const dashboardResizeHandles = ['se', 'e', 's', 'w'] as const

/**
 * Pixel height of a card's native row span, using the same row height and gap
 * SnapGrid positions it with (internal row gaps included, trailing gap not).
 */
export function widgetPixelHeight(widget: Pick<DashboardWidget, 'h'>) {
  return widget.h * gridRowHeight + (widget.h - 1) * gridCardGap
}

/**
 * Pixel height of the grid canvas for `rows` rows, mirroring the library's own
 * container height (`@snapgridjs/react` `containerHeight`): both insets plus
 * every row unit, with the trailing gap left out. View and edit mode size their
 * canvas with this one function, so the canvas bounds always match the item and
 * placeholder bounds and toggling the mode never changes the height by an
 * amount the grid geometry does not explain.
 */
export function gridSurfaceHeight(rows: number) {
  const [, insetY] = gridSurfacePadding
  if (rows <= 0) return insetY * 2
  return insetY * 2 + rows * gridRowHeight + (rows - 1) * gridCardGap
}

/**
 * The column the card form keeps when a card's width changes outside a drag
 * gesture: a wider card keeps its right edge (the same anchoring as the native
 * west handle), a narrower one keeps its left edge. This is the only place that
 * re-anchors an edited card; the save path stores the resulting `x` as-is.
 */
export function anchoredColumn(
  widget: Pick<DashboardWidget, 'x' | 'w'>,
  width: number
) {
  return width <= widget.w ? widget.x : Math.max(0, widget.x + widget.w - width)
}

/** One persisted card as a SnapGrid layout item, with its exact native size. */
export function layoutItemForWidget(widget: DashboardWidget): LayoutItem {
  return {
    i: widget.id,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.h,
  }
}

/** The controlled SnapGrid layout for a saved or drafted definition. */
export function layoutForWidgets(widgets: DashboardWidget[]): LayoutItem[] {
  return widgets.map(layoutItemForWidget)
}

/** SnapGrid geometry for a measured container width. */
export function dashboardPositionParams(width: number): PositionParams {
  return toPositionParams(dashboardGridConfig, width)
}

/**
 * Horizontal pitch of one grid column: the library's own column width plus the
 * card gap. The editing guide draws its cells from this, so the backdrop and the
 * cards share one measurement instead of two copies of the same formula.
 */
export function gridColumnPitch(width: number) {
  return calcGridColWidth(dashboardPositionParams(width)) + gridCardGap
}

/**
 * Pixel box of a card, from SnapGrid's own geometry. Used by the read-only
 * layout, which renders the same positions without mounting any sensors.
 */
export function widgetPixelRect(
  widget: DashboardWidget,
  positionParams: PositionParams
) {
  return calcGridItemPosition(
    positionParams,
    widget.x,
    widget.y,
    widget.w,
    widget.h
  )
}

/**
 * Defensive check over the pending definition, mirroring the server's rules:
 * safe integer geometry, at least one column and row, inside the four columns,
 * and no overlapping pair. There is no per-type or fixed row cap; rectangle
 * checks stay O(n^2) and never iterate the cells of a card.
 */
function hasInvalidPlacement(widgets: DashboardWidget[]) {
  const invalid = widgets.some(
    (widget) =>
      !Number.isInteger(widget.x) ||
      !Number.isSafeInteger(widget.y) ||
      !Number.isInteger(widget.w) ||
      !Number.isSafeInteger(widget.h) ||
      widget.x < 0 ||
      widget.y < 0 ||
      widget.w < 1 ||
      widget.h < 1 ||
      widget.x + widget.w > dashboardGridColumns ||
      !Number.isSafeInteger(widget.y + widget.h)
  )
  if (invalid) return true
  const layout = layoutForWidgets(widgets)
  return layout.some((item) => getAllCollisions(layout, item).length > 0)
}

/**
 * Maps a committed SnapGrid layout back onto the definition. Every card keeps
 * its options and receives the library's `x`, `y`, `w` and `h` exactly: there
 * is no snapping, clamping or reordering, so the committed geometry is what the
 * user saw and what the server stores. Returns null instead of a layout the
 * server would reject.
 */
export function widgetsFromLayout(
  widgets: DashboardWidget[],
  layout: Layout
): DashboardWidget[] | null {
  const items = new Map<string, LayoutItem>(
    layout.map((item): [string, LayoutItem] => [item.i, item])
  )
  const next: DashboardWidget[] = []
  for (const widget of widgets) {
    const item = items.get(widget.id)
    if (!item) return null
    next.push({
      ...widget,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    })
  }
  if (hasInvalidPlacement(next)) return null
  return next
}

/**
 * Top-down, left-to-right search for a free rectangle of the card's size over a
 * candidate row set that is independent of the geometry magnitude: the top of
 * the grid plus every existing card's bottom edge. Any free rectangle can slide
 * straight up (keeping its columns) until it reaches row zero or one of those
 * edges, so at most `widget count + 1` rows are examined — never one collision
 * pass per row of a tall card.
 */
function firstFreeCell(layout: Layout, item: LayoutItem) {
  const rows = [
    ...new Set([0, ...layout.map((entry) => entry.y + entry.h)]),
  ].sort((left, right) => left - right)
  for (const row of rows)
    for (let column = 0; column <= dashboardGridColumns - item.w; column += 1) {
      const candidate = { ...item, x: column, y: row }
      if (getAllCollisions(layout, candidate).length === 0)
        return { x: column, y: row }
    }
  return null
}

/**
 * Places a new card through SnapGrid's insert op, so a new card shares the same
 * layout engine and vertical reflow as a drag. The library owns the resulting
 * geometry; the definition receives it exactly.
 */
export function insertWidget(
  widgets: DashboardWidget[],
  widget: DashboardWidget
): DashboardWidget[] | null {
  const layout = layoutForWidgets(widgets)
  const item = layoutItemForWidget(widget)
  const cell = firstFreeCell(layout, item)
  if (!cell) return null
  const next = insertItemWithCompactor(layout, item, cell.x, cell.y, {
    compactor: verticalCompactor,
    cols: dashboardGridColumns,
  })
  if (!next.some((entry) => entry.i === widget.id)) return null
  return widgetsFromLayout([...widgets, widget], next)
}

/**
 * Applies an edited card through the library's resize op. The caller already
 * decided the card's column when its width changed (`anchoredColumn` in the
 * card form), so its geometry is used exactly as given — anchoring happens in
 * one place only — and neighbours reflow with the same vertical compactor a
 * drag uses. An edit that only changed options leaves committed geometry alone.
 */
export function replaceWidget(
  widgets: DashboardWidget[],
  updated: DashboardWidget
): DashboardWidget[] | null {
  const layout = layoutForWidgets(widgets)
  const current = layout.find((item) => item.i === updated.id)
  if (!current) return null
  if (hasInvalidPlacement([updated])) return null
  const unchanged =
    current.x === updated.x &&
    current.y === updated.y &&
    current.w === updated.w &&
    current.h === updated.h
  const next = unchanged
    ? layout
    : resizeItemWithCompactor(
        layout,
        current,
        { x: updated.x, y: updated.y, w: updated.w, h: updated.h },
        { compactor: verticalCompactor, cols: dashboardGridColumns }
      )
  return widgetsFromLayout(
    widgets.map((entry) => (entry.id === updated.id ? updated : entry)),
    next
  )
}

/** Number of occupied grid rows (at least one) for the editor surface. */
export function occupiedRows(widgets: DashboardWidget[]) {
  return widgets.reduce(
    (total, widget) => Math.max(total, widget.y + widget.h),
    1
  )
}

/** True when two drafts differ in identity, position or size. */
export function placementChanged(
  before: DashboardWidget[],
  after: DashboardWidget[]
) {
  if (before.length !== after.length) return true
  return before.some((widget, index) => {
    const other = after[index]
    return (
      !other ||
      other.id !== widget.id ||
      other.x !== widget.x ||
      other.y !== widget.y ||
      other.w !== widget.w ||
      other.h !== widget.h
    )
  })
}

/**
 * Canonical reading order for a spatial layout: row first, then column, with
 * the stored array index as a stable tie-breaker. Used by the mobile stack;
 * saved coordinates are never reordered.
 */
export function readingOrder(widgets: DashboardWidget[]) {
  return widgets
    .map((widget, index) => ({ widget, index }))
    .sort(
      (left, right) =>
        left.widget.y - right.widget.y ||
        left.widget.x - right.widget.x ||
        left.index - right.index
    )
    .map((entry) => entry.widget)
}
