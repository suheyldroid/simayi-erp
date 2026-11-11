'use client'

/*
 * Adapted from Arc UI's sortable data table:
 * https://uiarc.dev/components/sortable-data-table
 * Registry source: https://uiarc.dev/r/sortable-data-table.json
 *
 * Arc's own row modelling, sorting and selection state are replaced by
 * @tanstack/react-table (`ColumnDef`, `SortingState`, `RowSelectionState`).
 * The Arc interactions are kept: animated sort glyph, tinted sorted column,
 * row position animation, Shift-click range selection, mixed select-all box,
 * selected count with clear, keyboard navigation, status announcements and the
 * folded mobile layout. Styling uses this project's palette and square geometry
 * instead of the Arc foundation tokens.
 */
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react'
import { useDirection } from '@radix-ui/react-direction'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type OnChangeFn,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Updater,
} from '@tanstack/react-table'
import { ArrowUp } from 'lucide-react'
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type Transition,
  type Variants,
} from 'motion/react'
import styles from './sortable-data-table.module.css'

/** Extra column metadata this table understands on top of TanStack's. */
export type SortableColumnMeta = {
  /** Plain-text label for announcements; falls back to a string header, then the id. */
  label?: string
  /** Right-aligns with tabular numerals. Detected when every value is a number. */
  numeric?: boolean
  /** Fixed width such as 120 or "20%". Other columns are measured once and held. */
  width?: number | string
}

/**
 * A flat, leaf column definition. Nested `columns` are rejected because this
 * table renders one header row; provide one entry per rendered column.
 */
export type SortableColumn<TData> = ColumnDef<TData, unknown> & {
  columns?: never
  meta?: SortableColumnMeta
}

export type SortableDataTableProps<TData extends object> = {
  data: TData[]
  /** Flat leaf columns only; grouped `columns` definitions are not rendered. */
  columns: SortableColumn<TData>[]
  getRowId: (row: TData) => string
  caption?: string
  emptyMessage?: string
  sorting?: SortingState
  defaultSorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
  /** Adds a checkbox column, row click selection, and a count line with a clear action. */
  selectable?: boolean
  rowSelection?: RowSelectionState
  defaultRowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  /** Noun for the count line, as in "6 users". */
  itemName?: { one: string; other: string }
}

const timings = {
  standard: 0.26,
  fast: 0.16,
  instant: 0.08,
} as const
const springs = {
  smooth: { type: 'spring', stiffness: 460, damping: 42, mass: 1 },
  snappy: { type: 'spring', stiffness: 640, damping: 34, mass: 0.8 },
  morph: { type: 'spring', stiffness: 420, damping: 40, mass: 1 },
} as const
const blur = (px: number) => `blur(${px}px)`
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })
const comparable = (value: unknown) =>
  value instanceof Date ? value.getTime() : value
/** Arc compares numbers numerically and every other value with a numeric-aware collator. */
function compareValues<TData extends object>(
  rowA: Row<TData>,
  rowB: Row<TData>,
  columnId: string
) {
  const left = comparable(rowA.getValue(columnId))
  const right = comparable(rowB.getValue(columnId))
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return collator.compare(String(left), String(right))
}
const enter: Transition = { duration: timings.standard, ease: 'easeOut' }
const leave: Transition = { duration: timings.fast, ease: 'easeIn' }
const instant: Transition = { duration: timings.instant }
/** Changing text rises in from the side it is moving toward and lifts away on the other. */
const rise: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    y: `${0.3 * direction}em`,
    filter: blur(2),
  }),
  shown: { opacity: 1, y: '0em', filter: blur(0), transition: enter },
  gone: (direction: number) => ({
    opacity: 0,
    y: `${-0.3 * direction}em`,
    filter: blur(1),
    transition: leave,
  }),
}
/** Reduced motion keeps the same properties as rise (no travel, no blur) so nothing jumps. */
const fade: Variants = {
  enter: { opacity: 0, y: '0em', filter: blur(0) },
  shown: { opacity: 1, y: '0em', filter: blur(0), transition: instant },
  gone: { opacity: 0, y: '0em', filter: blur(0), transition: instant },
}
/** Check and dash share three points, so the header box morphs between all and some. */
const checkPath = 'M4.25 9.25 L7.25 12.25 L13.75 5.75'
const dashPath = 'M4.75 9 L9 9 L13.25 9'

/** Text that changes in place. The slot eases to the new width, so the words beside it never jump. */
function Swap({
  value,
  direction,
  reduced,
  className,
}: {
  value: string
  direction: number
  reduced: boolean
  className?: string
}) {
  const inner = useRef<HTMLSpanElement>(null)
  const width = useMotionValue<number | string>('auto')
  useLayoutEffect(() => {
    const node = inner.current
    if (!node) return
    let settled = false
    const measure = () => {
      const next = node.getBoundingClientRect().width
      if (settled && !reduced) animate(width, next, springs.morph)
      else width.jump(next)
      settled = true
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [reduced, width])
  return (
    <motion.span
      className={[styles.swap, className].filter(Boolean).join(' ')}
      style={{ width }}
    >
      <span ref={inner} className={styles.swapInner}>
        <AnimatePresence mode='popLayout' initial={false} custom={direction}>
          <motion.span
            key={value}
            className={styles.swapText}
            custom={direction}
            variants={reduced ? fade : rise}
            initial='enter'
            animate='shown'
            exit='gone'
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.span>
  )
}

/** The arrow fades in where a column becomes sorted and flips on a spring when the direction changes. */
function SortGlyph({
  active,
  descending,
  reduced,
}: {
  active: boolean
  descending: boolean
  reduced: boolean
}) {
  const rotate = useMotionValue(descending ? 180 : 0)
  const seen = useRef({ active, hiddenAt: -Infinity })
  useLayoutEffect(() => {
    const state = seen.current
    if (active) {
      // Turn only while the arrow is visible; a freshly shown arrow starts pointing the right way.
      const visible = state.active || performance.now() - state.hiddenAt < 160
      if (visible && !reduced)
        animate(rotate, descending ? 180 : 0, springs.snappy)
      else rotate.jump(descending ? 180 : 0)
    } else if (state.active) state.hiddenAt = performance.now()
    state.active = active
  }, [active, descending, reduced, rotate])
  const transition: Transition = reduced
    ? instant
    : active
      ? { opacity: enter, filter: enter, scale: springs.snappy }
      : { duration: timings.instant, ease: 'easeOut' }
  return (
    <span className={styles.sortIcon} aria-hidden='true'>
      <ArrowUp className={styles.sortHint} size={16} strokeWidth={1.75} />
      <motion.span
        className={styles.sortArrow}
        style={{ rotate }}
        initial={false}
        animate={
          active
            ? { opacity: 1, scale: 1, filter: blur(0) }
            : { opacity: 0, scale: 0.6, filter: blur(1) }
        }
        transition={transition}
      >
        <ArrowUp size={16} strokeWidth={1.75} />
      </motion.span>
    </span>
  )
}

function SelectBox({
  checked,
  mixed = false,
  label,
  nav,
  reduced,
  disabled = false,
  onToggle,
  inputRef,
}: {
  checked: boolean
  mixed?: boolean
  label: string
  nav: 'head' | 'row'
  reduced: boolean
  disabled?: boolean
  onToggle: (extend: boolean) => void
  inputRef?: RefObject<HTMLInputElement | null>
}) {
  const local = useRef<HTMLInputElement>(null)
  const ref = inputRef ?? local
  const on = checked || mixed
  useLayoutEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed
  }, [mixed, ref])
  const opacity: Transition = {
    duration: on ? timings.instant : timings.fast,
    ease: 'easeOut',
  }
  return (
    <label className={styles.selectHit} data-disabled={disabled || undefined}>
      <input
        ref={ref}
        type='checkbox'
        className={styles.selectInput}
        checked={checked}
        disabled={disabled}
        aria-label={label}
        data-nav={nav}
        onChange={(event) =>
          onToggle((event.nativeEvent as MouseEvent).shiftKey === true)
        }
      />
      <span
        className={styles.selectBox}
        data-on={on || undefined}
        aria-hidden='true'
      >
        <motion.span
          className={styles.selectFill}
          initial={false}
          animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.6 }}
          transition={
            reduced ? { duration: 0 } : { scale: springs.snappy, opacity }
          }
        />
        <svg
          className={styles.selectMark}
          viewBox='0 0 18 18'
          fill='none'
          focusable='false'
        >
          <motion.path
            initial={false}
            animate={{
              d: mixed ? dashPath : checkPath,
              pathLength: on ? 1 : 0,
              opacity: on ? 1 : 0,
            }}
            transition={
              reduced
                ? { duration: 0 }
                : { d: springs.morph, pathLength: springs.snappy, opacity }
            }
            stroke='currentColor'
            strokeWidth={1.75}
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
      </span>
    </label>
  )
}

const labelFor = <TData extends object>(column: Column<TData, unknown>) => {
  const meta = column.columnDef.meta as SortableColumnMeta | undefined
  if (meta?.label) return meta.label
  const header = column.columnDef.header
  return typeof header === 'string' ? header : column.id
}

export function SortableDataTable<TData extends object>({
  data,
  columns,
  getRowId,
  caption = 'Data table',
  emptyMessage = 'No rows to show',
  sorting: sortingProp,
  defaultSorting,
  onSortingChange,
  selectable = false,
  rowSelection: rowSelectionProp,
  defaultRowSelection,
  onRowSelectionChange,
  itemName = { one: 'row', other: 'rows' },
}: SortableDataTableProps<TData>) {
  const reduced = useReducedMotion() ?? false
  const direction = useDirection()
  const tableRef = useRef<HTMLTableElement>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)
  const anchor = useRef<string | null>(null)
  const [internalSorting, setInternalSorting] = useState<SortingState>(
    defaultSorting ?? []
  )
  const [internalSelection, setInternalSelection] = useState<RowSelectionState>(
    defaultRowSelection ?? {}
  )
  const [announcement, setAnnouncement] = useState('')
  const sorting = sortingProp ?? internalSorting
  const selection = rowSelectionProp ?? internalSelection

  const handleSortingChange = (updater: Updater<SortingState>) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    if (sortingProp === undefined) setInternalSorting(next)
    onSortingChange?.(next)
  }

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { sorting, rowSelection: selection },
    onSortingChange: handleSortingChange,
    enableSortingRemoval: false,
    enableMultiSort: false,
    sortDescFirst: false,
    defaultColumn: { sortingFn: compareValues, sortUndefined: 'last' },
    enableRowSelection: selectable,
    onRowSelectionChange: (updater) => updateSelection(updater),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const rows = table.getRowModel().rows
  const keys = rows.map((row) => row.id)
  const order = keys.join('\u0000')
  const selectedCount = rows.filter((row) => row.getIsSelected()).length
  const allSelected = rows.length > 0 && selectedCount === rows.length
  const activeSort = sorting[0]

  const leafColumns = table.getAllLeafColumns()
  const numeric = useMemo(() => {
    const ids = new Set<string>()
    if (!rows.length) return ids
    for (const column of leafColumns) {
      const meta = column.columnDef.meta as SortableColumnMeta | undefined
      if (meta?.numeric) {
        ids.add(column.id)
        continue
      }
      if (meta?.numeric === false || !column.accessorFn) continue
      if (rows.every((row) => typeof row.getValue(column.id) === 'number'))
        ids.add(column.id)
    }
    return ids
  }, [leafColumns, rows])

  // Measure the natural column widths once, then hold them with a fixed layout so nothing reflows while rows move.
  const signature = [
    selectable ? 'select' : '',
    ...leafColumns.map((column) => column.id),
  ].join('\u0000')
  const [locked, setLocked] = useState<{
    signature: string
    widths: Record<string, number>
  } | null>(null)
  const widths = locked?.signature === signature ? locked.widths : null
  useLayoutEffect(() => {
    const tableElement = tableRef.current
    if (!tableElement || widths) return
    const element = tableElement
    const measure = () => {
      const total = element.getBoundingClientRect().width
      if (!total || getComputedStyle(element).display !== 'table') return false
      const next: Record<string, number> = {}
      element
        .querySelectorAll<HTMLElement>('thead th[data-key]')
        .forEach((cell) => {
          next[cell.dataset.key ?? ''] =
            (cell.getBoundingClientRect().width / total) * 100
        })
      setLocked({ signature, widths: next })
      return true
    }
    // The observer's first callback is the initial measurement; later callbacks
    // cover fonts, zoom and container resizes until the widths are locked.
    const observer = new ResizeObserver(() => {
      if (measure()) observer.disconnect()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [signature, widths])

  // A still tint under the sorted column fills the gaps that open while rows pass each other.
  const bandRef = useRef<HTMLSpanElement>(null)
  const seenSort = useRef(false)
  useLayoutEffect(() => {
    const tableElement = tableRef.current
    const key = activeSort?.id
    // Pure visual measurement: the band is painted outside React's state.
    const update = () => {
      const band = bandRef.current
      if (!band) return
      const cell = key
        ? tableElement?.querySelector<HTMLElement>(
            `thead th[data-key="${CSS.escape(key)}"]`
          )
        : null
      if (!cell) {
        band.style.opacity = '0'
        return
      }
      band.style.opacity = '1'
      band.style.left = `${cell.offsetLeft}px`
      band.style.width = `${cell.offsetWidth}px`
    }
    update()
    if (!tableElement || !key) return
    // On a phone the header is a scrolling strip of sort controls; keep the active one in view.
    const cell = tableElement.querySelector<HTMLElement>(
      `thead th[data-key="${CSS.escape(key)}"]`
    )
    const strip = cell?.parentElement
    if (
      cell &&
      strip &&
      strip.scrollWidth > strip.clientWidth &&
      getComputedStyle(tableElement).display !== 'table'
    ) {
      cell.scrollIntoView({
        inline: 'nearest',
        block: 'nearest',
        behavior: reduced || !seenSort.current ? 'auto' : 'smooth',
      })
    }
    seenSort.current = true
    const observer = new ResizeObserver(update)
    observer.observe(tableElement)
    return () => observer.disconnect()
  }, [direction, reduced, activeSort?.id, widths])

  const shownCount = selectedCount || keys.length
  const noun = selectedCount
    ? 'selected'
    : keys.length === 1
      ? itemName.one
      : itemName.other
  const [lastCount, setLastCount] = useState(shownCount)
  const [countDirection, setCountDirection] = useState(1)
  if (shownCount !== lastCount) {
    setLastCount(shownCount)
    setCountDirection(shownCount > lastCount ? 1 : -1)
  }

  function sortBy(column: Column<TData, unknown>) {
    const descending = column.getIsSorted() === 'asc'
    column.toggleSorting(descending, false)
    setAnnouncement(
      `Sorted by ${labelFor(column)}, ${
        descending ? 'descending' : 'ascending'
      }`
    )
  }

  function updateSelection(updater: Updater<RowSelectionState>) {
    const next = typeof updater === 'function' ? updater(selection) : updater
    // Never keep ids that are not on the current page.
    const ids = new Set(keys)
    const pruned: RowSelectionState = {}
    for (const [id, selected] of Object.entries(next)) {
      if (selected && ids.has(id)) pruned[id] = true
    }
    if (rowSelectionProp === undefined) setInternalSelection(pruned)
    onRowSelectionChange?.(pruned)
    const count = keys.filter((id) => pruned[id]).length
    setAnnouncement(
      count ? `${count} of ${keys.length} selected` : 'Selection cleared'
    )
  }

  function toggleRow(key: string, extend: boolean) {
    const next = new Set(keys.filter((id) => selection[id]))
    const checked = !next.has(key)
    const from = extend && anchor.current ? keys.indexOf(anchor.current) : -1
    const to = keys.indexOf(key)
    const range =
      from < 0 ? [key] : keys.slice(Math.min(from, to), Math.max(from, to) + 1)
    range.forEach((item) => (checked ? next.add(item) : next.delete(item)))
    anchor.current = key
    const record: RowSelectionState = {}
    next.forEach((id) => {
      record[id] = true
    })
    updateSelection(record)
  }

  function toggleAll() {
    if (!keys.length) return
    const record: RowSelectionState = {}
    if (!allSelected) keys.forEach((key) => (record[key] = true))
    updateSelection(record)
  }

  function clearSelection() {
    updateSelection({})
    selectAllRef.current?.focus()
  }

  function onRowClick(
    event: ReactMouseEvent<HTMLTableRowElement>,
    key: string
  ) {
    if (
      !selectable ||
      (event.target as HTMLElement).closest(
        "a, button, input, label, select, textarea, [role='button'], [contenteditable='true']"
      ) ||
      window.getSelection()?.toString()
    )
      return
    toggleRow(key, event.shiftKey)
    // Keep the keyboard path where the pointer left off, so arrows continue from this row.
    event.currentTarget
      .querySelector<HTMLInputElement>("input[type='checkbox']")
      ?.focus({ preventScroll: true })
  }

  /** Arrows walk the header controls and the row checkboxes; Escape clears the selection. */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (event.key === 'Escape' && selectedCount) {
      event.preventDefault()
      event.stopPropagation()
      if (target.dataset.clear !== undefined) clearSelection()
      else updateSelection({})
      return
    }
    const nav = target.dataset.nav
    if (!nav) return
    const list = (name: string) => [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        `[data-nav="${name}"]`
      ),
    ]
    const items = list(nav)
    const index = items.indexOf(target)
    // Horizontal header movement follows the writing direction, like native controls.
    const forward =
      getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1
    const steps: Record<string, [HTMLElement[], number]> =
      nav === 'head'
        ? {
            ArrowRight: [items, index + forward],
            ArrowLeft: [items, index - forward],
            Home: [items, 0],
            End: [items, items.length - 1],
          }
        : {
            ArrowDown: [items, index + 1],
            ArrowUp:
              index === 0 && selectAllRef.current
                ? [[selectAllRef.current], 0]
                : [items, index - 1],
            Home: [items, 0],
            End: [items, items.length - 1],
          }
    if (nav === 'head' && target === selectAllRef.current)
      steps.ArrowDown = [list('row'), 0]
    const step = steps[event.key]
    const next = step?.[0][step[1]]
    if (!next) return
    event.preventDefault()
    next.focus()
  }

  // Flat leaf columns only, so the first header group holds every column.
  const headerGroup = table.getHeaderGroups()[0]

  return (
    <div className={styles.wrapper} dir={direction} onKeyDown={onKeyDown}>
      <div className={styles.scroller}>
        {activeSort ? (
          <span ref={bandRef} className={styles.band} aria-hidden='true' />
        ) : null}
        <table
          ref={tableRef}
          role='table'
          className={styles.table}
          data-fixed={widths ? '' : undefined}
          data-selectable={selectable || undefined}
        >
          <caption>{caption}</caption>
          <colgroup>
            {selectable ? <col className={styles.selectCol} /> : null}
            {leafColumns.map((column) => {
              const width = (
                column.columnDef.meta as SortableColumnMeta | undefined
              )?.width
              return (
                <col
                  key={column.id}
                  style={{
                    width:
                      width !== undefined
                        ? typeof width === 'number'
                          ? `${width}px`
                          : width
                        : widths
                          ? `${widths[column.id]}%`
                          : undefined,
                  }}
                />
              )
            })}
          </colgroup>
          <thead role='rowgroup'>
            <tr role='row'>
              {selectable ? (
                <th
                  scope='col'
                  role='columnheader'
                  className={styles.selectCell}
                >
                  <SelectBox
                    inputRef={selectAllRef}
                    checked={allSelected}
                    mixed={selectedCount > 0 && !allSelected}
                    label='Select all rows on this page'
                    nav='head'
                    reduced={reduced}
                    disabled={!rows.length}
                    onToggle={toggleAll}
                  />
                </th>
              ) : null}
              {headerGroup?.headers.map((header, index) => {
                const column = header.column
                const sortable = column.getCanSort()
                const direction = column.getIsSorted()
                const active = direction !== false
                return (
                  <th
                    key={header.id}
                    scope='col'
                    role='columnheader'
                    data-key={column.id}
                    data-primary={index === 0 || undefined}
                    data-sorted={active || undefined}
                    data-numeric={numeric.has(column.id) || undefined}
                    data-sortable={sortable || undefined}
                    aria-sort={
                      !sortable
                        ? undefined
                        : active
                          ? direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                    }
                  >
                    {sortable ? (
                      <button
                        className={styles.sortButton}
                        type='button'
                        data-nav='head'
                        onClick={() => sortBy(column)}
                        aria-label={`Sort by ${labelFor(column)}${
                          active
                            ? `, currently ${
                                direction === 'asc' ? 'ascending' : 'descending'
                              }`
                            : ''
                        }`}
                      >
                        <span className={styles.sortInner}>
                          {flexRender(
                            column.columnDef.header,
                            header.getContext()
                          )}
                          <SortGlyph
                            active={active}
                            descending={direction === 'desc'}
                            reduced={reduced}
                          />
                        </span>
                      </button>
                    ) : (
                      flexRender(column.columnDef.header, header.getContext())
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody role='rowgroup'>
            {rows.length ? (
              rows.map((row) => {
                const selected = selectable && row.getIsSelected()
                return (
                  <motion.tr
                    key={row.id}
                    role='row'
                    layout={reduced ? false : 'position'}
                    layoutDependency={order}
                    transition={springs.smooth}
                    data-selected={selected || undefined}
                    onClick={(event) => onRowClick(event, row.id)}
                    onMouseDown={(event) => {
                      if (selectable && event.shiftKey) event.preventDefault()
                    }}
                  >
                    {selectable ? (
                      <td role='cell' className={styles.selectCell}>
                        <SelectBox
                          checked={row.getIsSelected()}
                          label={`Select ${String(
                            row.getVisibleCells()[0]?.getValue() ?? row.id
                          )}`}
                          nav='row'
                          reduced={reduced}
                          onToggle={(extend) => toggleRow(row.id, extend)}
                        />
                      </td>
                    ) : null}
                    {row.getVisibleCells().map((cell, index) => (
                      <td
                        key={cell.id}
                        role='cell'
                        data-label={labelFor(cell.column)}
                        data-primary={index === 0 || undefined}
                        data-sorted={
                          activeSort?.id === cell.column.id || undefined
                        }
                        data-numeric={numeric.has(cell.column.id) || undefined}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </motion.tr>
                )
              })
            ) : (
              <tr role='row'>
                <td
                  role='cell'
                  className={styles.empty}
                  colSpan={leafColumns.length + (selectable ? 1 : 0)}
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {selectable ? (
        <div className={styles.footer}>
          <span className={styles.srOnly}>
            {shownCount} {noun}
          </span>
          <span
            className={styles.count}
            data-active={selectedCount > 0 || undefined}
            aria-hidden='true'
          >
            <Swap
              className={styles.number}
              value={String(shownCount)}
              direction={countDirection}
              reduced={reduced}
            />
            <Swap
              value={noun}
              direction={selectedCount ? 1 : -1}
              reduced={reduced}
            />
          </span>
          <AnimatePresence initial={false}>
            {selectedCount ? (
              <motion.button
                key='clear'
                type='button'
                className={styles.clear}
                data-clear=''
                onClick={clearSelection}
                initial={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.96, filter: blur(2) }
                }
                animate={{ opacity: 1, scale: 1, filter: blur(0) }}
                exit={
                  reduced
                    ? { opacity: 0, transition: instant }
                    : {
                        opacity: 0,
                        scale: 0.98,
                        filter: blur(1),
                        transition: leave,
                      }
                }
                transition={reduced ? instant : enter}
                whileTap={
                  reduced
                    ? undefined
                    : { scale: 0.97, transition: { duration: timings.instant } }
                }
              >
                Clear selection
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
      <p className={styles.srOnly} role='status'>
        {announcement}
      </p>
    </div>
  )
}

export default SortableDataTable
