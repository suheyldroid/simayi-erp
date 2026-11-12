import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { dashboardBuilderApi, errorMessage, isDashboardConflict } from './api'
import { DashboardGrid } from './dashboard-grid'
import { createDashboardWidget, definitionsEqual } from './definition'
import { insertWidget, replaceWidget } from './grid'
import { TooltipIconButton } from './icon-button'
import type {
  DashboardBuilderScope,
  DashboardDefinition,
  DashboardWidget,
  DashboardWidgetResult,
} from './model'
import {
  dashboardCatalogQueryOptions,
  dashboardDataQueryOptions,
  dashboardLayoutQueryOptions,
} from './queries'
import { WidgetFormSheet } from './widget-form-sheet'

type SheetState =
  { mode: 'new'; widget: DashboardWidget } | { mode: 'edit'; id: string }

function cloneWidgets(widgets: DashboardWidget[]): DashboardWidget[] {
  return widgets.map((widget) => ({
    ...widget,
    filters: { statuses: [...widget.filters.statuses] },
  }))
}

/**
 * One saved personal dashboard per account and context. View and edit modes
 * are explicit; nothing autosaves, Cancel restores the persisted definition,
 * and Save sends the revision captured when editing started. Grid placement is
 * stored per card, so a viewport change never rewrites a saved layout.
 */
export function DashboardBuilder({ scope }: { scope: DashboardBuilderScope }) {
  const queryClient = useQueryClient()
  const layoutQuery = useQuery(dashboardLayoutQueryOptions(scope))
  const catalogQuery = useQuery(dashboardCatalogQueryOptions(scope))
  const saved = layoutQuery.data?.dashboard
  const catalog = catalogQuery.data

  const [draft, setDraft] = useState<DashboardWidget[] | null>(null)
  const [baselineRevision, setBaselineRevision] = useState<number | null>(null)
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [reloadOpen, setReloadOpen] = useState(false)
  const [saveError, setSaveError] = useState<unknown>(null)
  const [placementError, setPlacementError] = useState<string | null>(null)

  const editing = draft !== null
  const widgets = draft ?? saved?.definition.widgets ?? []
  const dataQuery = useQuery(
    dashboardDataQueryOptions(scope, widgets, widgets.length > 0)
  )
  const results = new Map<string, DashboardWidgetResult>(
    (dataQuery.data?.results ?? []).map(
      (result): [string, DashboardWidgetResult] => [result.id, result]
    )
  )
  const dirty =
    draft !== null &&
    saved !== undefined &&
    !definitionsEqual(draft, saved.definition.widgets)
  const stale =
    editing &&
    baselineRevision !== null &&
    saved !== undefined &&
    saved.revision !== baselineRevision
  const conflict = isDashboardConflict(saveError)
  const removing = removeId
    ? (draft ?? []).find((widget) => widget.id === removeId)
    : undefined

  const saveMutation = useMutation({
    mutationFn: (definition: DashboardDefinition) =>
      // The revision captured when editing started, never the latest refetched
      // one, so a competing save is reported as a conflict.
      dashboardBuilderApi.saveLayout(scope, baselineRevision ?? 0, definition),
    onSuccess: (layout) => {
      queryClient.setQueryData(
        dashboardLayoutQueryOptions(scope).queryKey,
        layout
      )
      setDraft(null)
      setBaselineRevision(null)
      setSheet(null)
      setSaveError(null)
      setPlacementError(null)
    },
    onError: (error) => setSaveError(error),
  })
  const busy = saveMutation.isPending || sheet !== null

  function exitEditing() {
    setDraft(null)
    setBaselineRevision(null)
    setSheet(null)
    setSaveError(null)
    setPlacementError(null)
  }

  function startEditing() {
    if (!saved) return
    setDraft(cloneWidgets(saved.definition.widgets))
    setBaselineRevision(saved.revision)
    setSaveError(null)
    setPlacementError(null)
  }

  function cancelEditing() {
    if (!saved || draft === null) return
    if (definitionsEqual(draft, saved.definition.widgets)) exitEditing()
    else setDiscardOpen(true)
  }

  function save() {
    if (!saved || draft === null || baselineRevision === null) return
    setSaveError(null)
    saveMutation.mutate({ version: 3, widgets: draft })
  }

  function addCard() {
    if (!catalog) return
    setPlacementError(null)
    setSheet({
      mode: 'new',
      widget: createDashboardWidget(catalog, 'column'),
    })
  }

  function saveCard(widget: DashboardWidget) {
    if (!sheet || !draft) return
    const next =
      sheet.mode === 'edit'
        ? replaceWidget(draft, widget)
        : insertWidget(draft, widget)
    if (!next) {
      setPlacementError(
        'This card could not be placed on the grid. Try another size, or move or remove another card first.'
      )
      return
    }
    setPlacementError(null)
    setDraft(next)
    setSheet(null)
  }

  const sheetWidget =
    sheet?.mode === 'new'
      ? sheet.widget
      : sheet?.mode === 'edit'
        ? (draft ?? []).find((widget) => widget.id === sheet.id)
        : undefined

  return (
    <section aria-label='Personal dashboard' className='space-y-3'>
      <div className='flex items-start justify-between gap-3'>
        <p className='max-w-3xl text-sm text-muted-foreground'>
          {scope.kind === 'global'
            ? 'Your own layout across every organization you currently belong to. It aggregates live business counts and never changes your active organization or business access.'
            : 'Your own layout inside this organization. Every member sees the same business data, but each account keeps a separate layout.'}
        </p>
        {!editing && saved && widgets.length > 0 ? (
          <TooltipIconButton
            label='Edit dashboard'
            tooltip='Edit dashboard layout'
            onClick={startEditing}
          >
            <Pencil aria-hidden='true' />
          </TooltipIconButton>
        ) : null}
      </div>

      {layoutQuery.isPending ? (
        <p role='status'>Loading your dashboard…</p>
      ) : null}
      {layoutQuery.isError ? (
        <div role='alert' className='space-y-2'>
          <p>
            Could not load your dashboard. {errorMessage(layoutQuery.error)}
          </p>
          <Button variant='outline' onClick={() => void layoutQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}

      {editing ? (
        <div className='flex flex-wrap items-center gap-2 rounded-md border border-border p-3'>
          <Button
            onClick={addCard}
            disabled={
              saveMutation.isPending ||
              !catalog ||
              widgets.length >= (catalog?.maxWidgets ?? 24)
            }
          >
            Add card
          </Button>
          <Button
            onClick={save}
            disabled={
              !dirty || saveMutation.isPending || baselineRevision === null
            }
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button
            variant='outline'
            onClick={cancelEditing}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <p className='text-xs text-muted-foreground'>
            Drag a card to move it — or focus a card, press Enter and use the
            arrow keys — and drag a card edge or corner to resize it to any
            column span and row height. Escape cancels the gesture in progress,
            and other cards reflow out of the way. Cancel discards the whole
            draft; nothing is saved until you choose Save.
          </p>
        </div>
      ) : null}

      {editing && catalogQuery.isError ? (
        <div role='alert' className='space-y-2'>
          <p>
            Could not load the card catalog. {errorMessage(catalogQuery.error)}
          </p>
          <Button variant='outline' onClick={() => void catalogQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}
      {editing && catalogQuery.isPending ? (
        <p role='status'>Loading the card catalog…</p>
      ) : null}
      {stale ? (
        <p role='status' className='text-sm text-muted-foreground'>
          This dashboard was saved from another session. Saving here will report
          a conflict instead of overwriting it.
        </p>
      ) : null}
      {saveError ? (
        <div
          role='alert'
          className='space-y-2 rounded-md border border-destructive/40 p-3'
        >
          <p>Could not save your dashboard. {errorMessage(saveError)}</p>
          {conflict ? (
            <Button variant='outline' onClick={() => setReloadOpen(true)}>
              Reload saved layout
            </Button>
          ) : null}
        </div>
      ) : null}

      {saved && widgets.length === 0 ? (
        <div className='space-y-2 rounded-md border border-dashed border-border p-6 text-center'>
          <p className='text-sm text-muted-foreground'>
            {editing
              ? 'This dashboard is empty. Add a card to start.'
              : 'Your dashboard is empty.'}
          </p>
          {editing ? (
            <Button
              onClick={addCard}
              disabled={!catalog || saveMutation.isPending}
            >
              Add a card
            </Button>
          ) : (
            <TooltipIconButton
              label='Edit dashboard'
              tooltip='Edit dashboard layout'
              onClick={startEditing}
            >
              <Pencil aria-hidden='true' />
            </TooltipIconButton>
          )}
        </div>
      ) : null}

      {saved && (widgets.length > 0 || editing) ? (
        <DashboardGrid
          widgets={widgets}
          editing={editing}
          busy={busy}
          canEdit={Boolean(catalog)}
          results={results}
          pending={dataQuery.isPending}
          error={dataQuery.isError ? dataQuery.error : null}
          onRetry={() => void dataQuery.refetch()}
          onLayoutChange={setDraft}
          onEdit={(widget) => {
            setPlacementError(null)
            setSheet({ mode: 'edit', id: widget.id })
          }}
          onRemove={(widget) => setRemoveId(widget.id)}
        />
      ) : null}

      {sheet && sheetWidget && catalog ? (
        <WidgetFormSheet
          scope={scope}
          catalog={catalog}
          widget={sheetWidget}
          mode={sheet.mode}
          placementError={placementError}
          onCancel={() => {
            setSheet(null)
            setPlacementError(null)
          }}
          onSave={saveCard}
        />
      ) : null}

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title='Discard dashboard changes?'
        desc='Your unsaved card changes, positions and sizes will be discarded and the saved dashboard will be restored.'
        confirmText='Discard'
        destructive
        handleConfirm={() => {
          setDiscardOpen(false)
          exitEditing()
        }}
      />
      <ConfirmDialog
        open={reloadOpen}
        onOpenChange={setReloadOpen}
        title='Reload the saved layout?'
        desc='Your unsaved changes will be discarded so the latest saved dashboard can be loaded.'
        confirmText='Reload'
        destructive
        handleConfirm={() => {
          setReloadOpen(false)
          exitEditing()
          void layoutQuery.refetch()
        }}
      />
      <ConfirmDialog
        open={removeId !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveId(null)
        }}
        title='Remove this card?'
        desc={
          removing
            ? `"${removing.title}" will be removed from this draft. Nothing is saved until you choose Save.`
            : 'This card will be removed from the draft.'
        }
        confirmText='Remove'
        destructive
        handleConfirm={() => {
          if (removeId)
            setDraft(
              (current) => current?.filter((w) => w.id !== removeId) ?? current
            )
          setRemoveId(null)
        }}
      />
    </section>
  )
}
