import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'
import { t } from '@/lib/i18n'
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
  const sheetOpen = sheet !== null
  // The draft, its revision baseline and the open card editor live only in
  // this component. Company and branch paths are different route matches, so
  // any navigation — a branch or company switch included — unmounts this tree.
  // Block it while work is unsaved and let the user discard explicitly instead
  // of losing the draft silently. Nothing is autosaved.
  const isUnsaved = useCallback(() => dirty || sheetOpen, [dirty, sheetOpen])
  const navigationBlocker = useBlocker({
    shouldBlockFn: isUnsaved,
    withResolver: true,
    enableBeforeUnload: isUnsaved,
  })

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
      setPlacementError(t('dashboard:builder.placementError'))
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
    <section
      aria-label={
        scope.kind === 'global'
          ? t('dashboard:builder.sectionGlobal')
          : scope.branchName
            ? t('dashboard:builder.sectionBranch', { branch: scope.branchName })
            : t('dashboard:builder.sectionOrganization')
      }
      className='space-y-3'
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='max-w-3xl space-y-1'>
          <p className='text-sm text-muted-foreground'>
            {scope.kind === 'global'
              ? t('dashboard:builder.introGlobal')
              : t('dashboard:builder.introOrganization')}
          </p>
          {scope.kind === 'organization' ? (
            <p className='text-sm text-muted-foreground'>
              {t('dashboard:builder.dataScope')}{' '}
              <span className='font-medium text-foreground'>
                {scope.branchName
                  ? t('dashboard:builder.scopeBranch', {
                      branch: scope.branchName,
                    })
                  : t('dashboard:builder.scopeCompany')}
              </span>
              . {t('dashboard:builder.scopeFixed')}
            </p>
          ) : null}
        </div>
        {!editing && saved && widgets.length > 0 ? (
          <TooltipIconButton
            label={t('dashboard:builder.edit')}
            tooltip={t('dashboard:builder.editTooltip')}
            onClick={startEditing}
          >
            <Pencil aria-hidden='true' />
          </TooltipIconButton>
        ) : null}
      </div>

      {layoutQuery.isPending ? (
        <p role='status'>{t('dashboard:builder.loading')}</p>
      ) : null}
      {layoutQuery.isError ? (
        <div role='alert' className='space-y-2'>
          <p>
            {t('dashboard:builder.loadError')} {errorMessage(layoutQuery.error)}
          </p>
          <Button variant='outline' onClick={() => void layoutQuery.refetch()}>
            {t('dashboard:common.retry')}
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
            {t('dashboard:builder.addCard')}
          </Button>
          <Button
            onClick={save}
            disabled={
              !dirty || saveMutation.isPending || baselineRevision === null
            }
          >
            {saveMutation.isPending
              ? t('dashboard:builder.saving')
              : t('dashboard:builder.save')}
          </Button>
          <Button
            variant='outline'
            onClick={cancelEditing}
            disabled={saveMutation.isPending}
          >
            {t('dashboard:builder.cancel')}
          </Button>
          <p className='text-xs text-muted-foreground'>
            {t('dashboard:builder.editingHint')}
          </p>
        </div>
      ) : null}

      {editing && catalogQuery.isError ? (
        <div role='alert' className='space-y-2'>
          <p>
            {t('dashboard:builder.catalogError')}{' '}
            {errorMessage(catalogQuery.error)}
          </p>
          <Button variant='outline' onClick={() => void catalogQuery.refetch()}>
            {t('dashboard:common.retry')}
          </Button>
        </div>
      ) : null}
      {editing && catalogQuery.isPending ? (
        <p role='status'>{t('dashboard:builder.catalogLoading')}</p>
      ) : null}
      {stale ? (
        <p role='status' className='text-sm text-muted-foreground'>
          {t('dashboard:builder.stale')}
        </p>
      ) : null}
      {saveError ? (
        <div
          role='alert'
          className='space-y-2 rounded-md border border-destructive/40 p-3'
        >
          <p>
            {t('dashboard:builder.saveError')} {errorMessage(saveError)}
          </p>
          {conflict ? (
            <Button variant='outline' onClick={() => setReloadOpen(true)}>
              {t('dashboard:builder.reload')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {saved && widgets.length === 0 ? (
        <div className='space-y-2 rounded-md border border-dashed border-border p-6 text-center'>
          <p className='text-sm text-muted-foreground'>
            {editing
              ? t('dashboard:builder.emptyEditing')
              : t('dashboard:builder.emptyView')}
          </p>
          {editing ? (
            <Button
              onClick={addCard}
              disabled={!catalog || saveMutation.isPending}
            >
              {t('dashboard:builder.addCardCta')}
            </Button>
          ) : (
            <TooltipIconButton
              label={t('dashboard:builder.edit')}
              tooltip={t('dashboard:builder.editTooltip')}
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
        open={navigationBlocker.status === 'blocked'}
        onOpenChange={(open) => {
          // Cancel, Escape or an outside press keeps the draft: the blocked
          // navigation is dropped, never confirmed on the user's behalf.
          if (!open) navigationBlocker.reset?.()
        }}
        title={t('dashboard:builder.discardTitle')}
        desc={t('dashboard:builder.discardDesc')}
        confirmText={t('dashboard:builder.discardConfirm')}
        destructive
        // A pending save may still commit, so it must not be reported as a
        // discarded draft. Cancel stays available.
        disabled={saveMutation.isPending}
        handleConfirm={() => {
          // Discard must clear the draft and the open editor even when the
          // destination does not unmount the builder (same path/hash moves).
          exitEditing()
          navigationBlocker.proceed?.()
        }}
      />
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={t('dashboard:builder.discardTitle')}
        desc={t('dashboard:builder.discardDesc')}
        confirmText={t('dashboard:builder.discardConfirm')}
        destructive
        handleConfirm={() => {
          setDiscardOpen(false)
          exitEditing()
        }}
      />
      <ConfirmDialog
        open={reloadOpen}
        onOpenChange={setReloadOpen}
        title={t('dashboard:builder.reloadTitle')}
        desc={t('dashboard:builder.reloadDesc')}
        confirmText={t('dashboard:builder.reloadConfirm')}
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
        title={t('dashboard:builder.removeTitle')}
        desc={
          removing
            ? t('dashboard:builder.removeDesc', { title: removing.title })
            : t('dashboard:builder.removeDescGeneric')
        }
        confirmText={t('dashboard:builder.removeConfirm')}
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
