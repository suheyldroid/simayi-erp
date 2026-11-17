import { useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOptionalBranch } from '@/lib/branch-boundary'
import {
  branchCacheScope,
  captureBranchScope,
  isBranchScopeCurrent,
  type CapturedBranchScope,
} from '@/lib/branch-scope'
import { locale, t } from '@/lib/i18n'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import {
  organizationLocation,
  useOrganizationResourceParams,
} from '@/lib/organization-navigation'
import { parseResourceUuid } from '@/lib/resource-uuid'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { BranchInactiveNotice } from '@/components/layout/branch-gate'
import { errorMessage, recipeApi } from './api'
import { invalidateCapturedRecipeData } from './cache'
import { RecipeSheet, type RecipeDraft } from './components/recipe-sheet'
import {
  RecipesModel,
  type RecipeCustomizeInput,
  type RecipeDetail as RecipeRecord,
  type RecipeUpdateInput,
} from './model'

type SheetDraft = {
  key: string
  mode: 'edit' | 'customize'
  record: RecipeRecord
}

type ConfirmDraft =
  | { kind: 'delete'; version: number; name: string }
  | { kind: 'reset'; version: number; name: string; customizationUuid: string }

type WriteInput =
  | {
      kind: 'update'
      captured: CapturedBranchScope
      uuid: string
      body: RecipeUpdateInput
    }
  | {
      kind: 'activation'
      captured: CapturedBranchScope
      uuid: string
      active: boolean
      version: number
    }
  | {
      kind: 'customize'
      captured: CapturedBranchScope
      uuid: string
      body: RecipeCustomizeInput
    }
  | {
      kind: 'reset'
      captured: CapturedBranchScope
      uuid: string
      version: number
      customizationUuid: string
    }

export function RecipeDetail() {
  const { recipeId } = useOrganizationResourceParams()
  const uuid = recipeId === undefined ? null : parseResourceUuid(recipeId)
  return <RecipeDetailView key={uuid ?? 'invalid'} uuid={uuid} />
}

function RecipeDetailView({ uuid }: { uuid: string | null }) {
  const branch = useOptionalBranch()
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const navigate = useNavigate()
  const branchUuid = branch?.branchUuid ?? null
  const branchMode = branchUuid !== null
  const writable = branch === null || branch.branch.active
  const scopeKey = branchCacheScope(branchUuid)
  const [sheetDraft, setSheetDraft] = useState<SheetDraft | null>(null)
  const [confirm, setConfirm] = useState<ConfirmDraft | null>(null)
  const details = useQuery({
    queryKey: ['recipe', scopeKey, 'detail', uuid, branchUuid],
    queryFn: () => {
      if (uuid === null)
        throw new Error(t('catalog:recipes.detail.recipeUuidRequired'))
      return recipeApi.recipe(uuid, branchUuid)
    },
    enabled: uuid !== null,
  })
  const detailStatus =
    details.error && axios.isAxiosError(details.error)
      ? details.error.response?.status
      : undefined
  const record = details.data
  const write = useMutation({
    mutationFn: (input: WriteInput) => {
      switch (input.kind) {
        case 'update':
          return recipeApi.update(
            input.uuid,
            input.body,
            input.captured.branchUuid
          )
        case 'activation':
          if (input.captured.branchUuid === null)
            throw new Error(t('catalog:recipes.detail.branchRequired'))
          return recipeApi.activation(
            input.uuid,
            { active: input.active, version: input.version },
            input.captured.branchUuid
          )
        case 'customize':
          if (input.captured.branchUuid === null)
            throw new Error(t('catalog:recipes.detail.branchRequired'))
          return recipeApi.customize(
            input.uuid,
            input.body,
            input.captured.branchUuid
          )
        case 'reset':
          if (input.captured.branchUuid === null)
            throw new Error(t('catalog:recipes.detail.branchRequired'))
          return recipeApi.reset(
            input.uuid,
            {
              version: input.version,
              customizationUuid: input.customizationUuid,
            },
            input.captured.branchUuid
          )
      }
    },
    onSuccess: async (_updated, input) => {
      await invalidateCapturedRecipeData(client, input.captured)
      if (!isBranchScopeCurrent(input.captured)) return
      setSheetDraft(null)
      setConfirm(null)
      toast.success(
        input.kind === 'activation'
          ? input.active
            ? t('catalog:recipes.toast.activated')
            : t('catalog:recipes.toast.deactivated')
          : input.kind === 'customize'
            ? t('catalog:recipes.toast.customized')
            : input.kind === 'reset'
              ? t('catalog:recipes.toast.reset')
              : t('catalog:recipes.toast.updated')
      )
    },
    onError: (caught, input) => {
      if (!isBranchScopeCurrent(input.captured)) return
      toast.error(errorMessage(caught))
      // A stale-version rejection must not trap the next attempt on the same
      // version; refresh the record while the sheet keeps the user's input.
      void client.invalidateQueries({
        queryKey: ['recipe', scopeKey, 'detail', uuid],
      })
    },
  })
  const deletion = useMutation({
    mutationFn: (input: {
      uuid: string
      version: number
      captured: CapturedBranchScope
    }) =>
      recipeApi.remove(input.uuid, input.version, input.captured.branchUuid),
    onSuccess: async (_result, input) => {
      await invalidateCapturedRecipeData(client, input.captured)
      if (!isBranchScopeCurrent(input.captured)) return
      setConfirm(null)
      toast.success(t('catalog:recipes.toast.deleted'))
      await navigate(
        organizationLocation(
          organizationSlug,
          input.captured.branchUuid,
          '/settings/recipes'
        )
      )
    },
    onError: (_caught, input) => {
      if (!isBranchScopeCurrent(input.captured)) return
      void client.invalidateQueries({
        queryKey: ['recipe', scopeKey, 'detail', uuid],
      })
    },
  })
  const reloadDraft = async () => {
    const draftKey = sheetDraft?.key
    if (draftKey === undefined) return
    const result = await details.refetch()
    if (result.isError || !result.data) {
      toast.error(
        result.error
          ? t('catalog:recipes.detail.reloadFailedWith', {
              message: errorMessage(result.error),
            })
          : t('catalog:recipes.detail.reloadFailed')
      )
      return
    }
    const fresh = result.data
    write.reset()
    setSheetDraft((current) =>
      current?.key === draftKey
        ? {
            key: crypto.randomUUID(),
            mode: current.mode,
            record: fresh,
          }
        : current
    )
  }

  function openSheet(mode: SheetDraft['mode'], source: RecipeRecord) {
    write.reset()
    setSheetDraft({ key: crypto.randomUUID(), mode, record: source })
  }

  function submitDraft(draft: RecipeDraft) {
    if (sheetDraft === null || record === null) return
    const captured = captureBranchScope(branchUuid)
    if (sheetDraft.mode === 'customize') {
      if (captured.branchUuid === null) return
      write.mutate({
        kind: 'customize',
        captured,
        uuid: sheetDraft.record.uuid,
        body: RecipesModel.customizeInput.parse({
          sourceVersion: sheetDraft.record.version,
          name: draft.name,
          code: draft.code,
          description: draft.description,
          sellable: draft.sellable,
          sellingPrice: draft.sellingPrice,
          ingredients: draft.ingredients,
        }),
      })
      return
    }
    const customized = sheetDraft.record.scope === 'customized'
    const customizationUuid = customized
      ? sheetDraft.record.customizationUuid
      : null
    if (customized && customizationUuid === null) return
    write.mutate({
      kind: 'update',
      captured,
      uuid: sheetDraft.record.uuid,
      body: RecipesModel.updateInput.parse({
        version: sheetDraft.record.version,
        // A customized definition is a specific row: a recycled numeric version
        // must not let a stale form overwrite its replacement.
        ...(customizationUuid === null ? {} : { customizationUuid }),
        name: draft.name,
        code: draft.code,
        description: draft.description,
        sellable: draft.sellable,
        sellingPrice: draft.sellingPrice,
        // Customized activity lives on the branch assignment, not the copy.
        ...(customized ? {} : { active: draft.active }),
        ingredients: draft.ingredients,
      }),
    })
  }

  const companyDisabled =
    record !== undefined &&
    record.scope !== 'local' &&
    !record.sourceRecipeActive
  const assigned = record?.activation?.active === true
  const canDelete =
    record !== undefined &&
    ((record.scope === 'company' && !branchMode) ||
      (record.scope === 'local' && branchMode))

  return (
    <>
      <section className='space-y-6'>
        <div>
          <Link
            {...organizationLocation(
              organizationSlug,
              branchUuid,
              '/settings/recipes'
            )}
            className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            {t('catalog:recipes.detail.back')}
          </Link>
          <h2 className='mt-2 text-2xl font-bold'>
            {record && !details.isError
              ? record.name
              : t('catalog:recipes.detail.title')}
          </h2>
        </div>
        {branch !== null && !branch.branch.active && (
          <BranchInactiveNotice branchName={branch.branch.name} />
        )}
        {uuid === null && (
          <p role='alert'>{t('catalog:recipes.detail.notFound')}</p>
        )}
        {uuid !== null && details.isPending && (
          <p role='status'>{t('catalog:recipes.detail.loading')}</p>
        )}
        {uuid !== null && details.isError && detailStatus === 404 && (
          <p role='alert'>{t('catalog:recipes.detail.notFound')}</p>
        )}
        {uuid !== null && details.isError && detailStatus !== 404 && (
          <p role='alert'>
            {errorMessage(details.error)}{' '}
            <Button variant='outline' onClick={() => void details.refetch()}>
              {t('catalog:common.retry')}
            </Button>
          </p>
        )}
        {record && !details.isError && (
          <>
            <section className='space-y-4 rounded-md border border-border p-4'>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <h3 className='text-xl font-semibold'>{record.name}</h3>
                  <p className='text-sm text-muted-foreground'>
                    {record.description ||
                      t('catalog:recipes.detail.noDescription')}
                  </p>
                </div>
                <div className='flex flex-wrap gap-2'>
                  {!branchMode && (
                    <Button
                      type='button'
                      variant='outline'
                      disabled={write.isPending}
                      onClick={() => openSheet('edit', record)}
                    >
                      {t('catalog:recipes.detail.edit')}
                    </Button>
                  )}
                  {branchMode && record.scope === 'company' && (
                    <Button
                      type='button'
                      variant='outline'
                      disabled={!writable || write.isPending || companyDisabled}
                      onClick={() => openSheet('customize', record)}
                    >
                      {t('catalog:recipes.detail.customize')}
                    </Button>
                  )}
                  {branchMode && record.scope !== 'company' && (
                    <Button
                      type='button'
                      variant='outline'
                      disabled={!writable || write.isPending}
                      onClick={() => openSheet('edit', record)}
                    >
                      {t('catalog:recipes.detail.edit')}
                    </Button>
                  )}
                  {branchMode && record.scope === 'customized' && (
                    <Button
                      type='button'
                      variant='outline'
                      disabled={!writable || write.isPending}
                      onClick={() => {
                        const customizationUuid = record.customizationUuid
                        if (customizationUuid === null) return
                        write.reset()
                        setConfirm({
                          kind: 'reset',
                          version: record.version,
                          name: record.name,
                          customizationUuid,
                        })
                      }}
                    >
                      {t('catalog:recipes.detail.reset')}
                    </Button>
                  )}
                  {branchMode && record.scope !== 'local' && (
                    <Button
                      type='button'
                      variant='outline'
                      disabled={
                        !writable ||
                        write.isPending ||
                        (!assigned && companyDisabled)
                      }
                      onClick={() =>
                        write.mutate({
                          kind: 'activation',
                          captured: captureBranchScope(branchUuid),
                          uuid: record.uuid,
                          active: !assigned,
                          version: record.activation?.version ?? 0,
                        })
                      }
                    >
                      {assigned
                        ? t('catalog:recipes.detail.deactivateInBranch')
                        : t('catalog:recipes.detail.activateInBranch')}
                    </Button>
                  )}
                  {branchMode && record.scope === 'local' && (
                    <Button
                      type='button'
                      variant='outline'
                      disabled={!writable || write.isPending}
                      onClick={() =>
                        write.mutate({
                          kind: 'update',
                          captured: captureBranchScope(branchUuid),
                          uuid: record.uuid,
                          body: RecipesModel.updateInput.parse({
                            version: record.version,
                            active: !record.active,
                          }),
                        })
                      }
                    >
                      {record.active
                        ? t('catalog:recipes.detail.deactivate')
                        : t('catalog:recipes.detail.activate')}
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      type='button'
                      variant='destructive'
                      disabled={!writable || deletion.isPending}
                      onClick={() => {
                        deletion.reset()
                        setConfirm({
                          kind: 'delete',
                          version: record.version,
                          name: record.name,
                        })
                      }}
                    >
                      {t('catalog:common.delete')}
                    </Button>
                  )}
                </div>
              </div>
              {companyDisabled && (
                <p role='alert' className='text-sm text-destructive'>
                  {t('catalog:recipes.detail.companyDisabledNotice')}
                </p>
              )}
              {branch !== null && !branch.branch.active && (
                <p className='text-sm text-muted-foreground'>
                  {t('catalog:recipes.detail.branchInactiveNotice')}
                </p>
              )}
              <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
                <dt>{t('catalog:recipes.detail.fields.code')}</dt>
                <dd>{record.code ?? t('catalog:recipes.detail.noCode')}</dd>
                <dt>{t('catalog:recipes.detail.fields.scope')}</dt>
                <dd>
                  {record.scope === 'local'
                    ? t('catalog:recipes.detail.scopeLocal')
                    : record.scope === 'customized'
                      ? t('catalog:recipes.detail.scopeCustomized')
                      : t('catalog:recipes.detail.scopeCompany')}
                </dd>
                {branch !== null && (
                  <>
                    <dt>{t('catalog:recipes.detail.fields.branch')}</dt>
                    <dd>
                      {branch.branch.name}
                      {branch.branch.active
                        ? ''
                        : t('catalog:branches.switcher.inactiveSuffix')}
                    </dd>
                  </>
                )}
                <dt>{t('catalog:recipes.detail.fields.effectiveState')}</dt>
                <dd>
                  {record.scope !== 'local' && !record.sourceRecipeActive
                    ? t('catalog:recipes.detail.blockedByCompany')
                    : record.active
                      ? t('catalog:common.active')
                      : t('catalog:common.inactive')}
                </dd>
                {branchMode && record.scope !== 'local' && (
                  <>
                    <dt>
                      {t('catalog:recipes.detail.fields.branchActivation')}
                    </dt>
                    <dd>
                      {assigned
                        ? t('catalog:recipes.detail.activated')
                        : t('catalog:recipes.detail.notActivated')}
                      {t('catalog:recipes.detail.assignmentVersion', {
                        version: record.activation?.version ?? 0,
                      })}
                    </dd>
                  </>
                )}
                {record.scope !== 'local' && (
                  <>
                    <dt>
                      {t('catalog:recipes.detail.fields.companyTemplate')}
                    </dt>
                    <dd>
                      {record.sourceRecipeActive
                        ? t('catalog:common.active')
                        : t('catalog:recipes.detail.disabled')}
                      {record.scope === 'customized'
                        ? t('catalog:recipes.detail.pinnedAt', {
                            version: record.sourceVersion ?? '—',
                          })
                        : ''}
                    </dd>
                  </>
                )}
                <dt>{t('catalog:recipes.detail.fields.version')}</dt>
                <dd>v{record.version}</dd>
                <dt>{t('catalog:recipes.detail.fields.sellingPrice')}</dt>
                <dd>
                  {record.sellingPrice === null
                    ? t('catalog:recipes.detail.notPriced')
                    : `${record.sellingPrice} ${record.priceCurrencyCode ?? ''}`.trim()}
                </dd>
                <dt>{t('catalog:recipes.detail.fields.sellable')}</dt>
                <dd>
                  {record.sellable
                    ? t('catalog:recipes.sellableYes')
                    : t('catalog:recipes.sellableNo')}
                </dd>
                <dt>{t('catalog:recipes.detail.fields.ingredients')}</dt>
                <dd>{record.ingredientCount}</dd>
                <dt>{t('catalog:recipes.detail.fields.created')}</dt>
                <dd>{new Date(record.createdAt).toLocaleString(locale)}</dd>
                <dt>{t('catalog:recipes.detail.fields.updated')}</dt>
                <dd>{new Date(record.updatedAt).toLocaleString(locale)}</dd>
              </dl>
            </section>
            {write.isError && (
              <p role='alert' className='text-sm text-destructive'>
                {errorMessage(write.error)}
              </p>
            )}
            {deletion.isError && (
              <p role='alert' className='text-sm text-destructive'>
                {errorMessage(deletion.error)}
              </p>
            )}
            <section className='space-y-2'>
              <h3 className='text-xl font-semibold'>
                {t('catalog:recipes.detail.ingredientsHeading')}
              </h3>
              <p className='text-sm text-muted-foreground'>
                {t('catalog:recipes.detail.ingredientsNote')}
              </p>
              <Table>
                <caption className='sr-only'>
                  {t('catalog:recipes.detail.tableCaption')}
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {t('catalog:recipes.detail.table.ingredient')}
                    </TableHead>
                    <TableHead>
                      {t('catalog:recipes.detail.table.type')}
                    </TableHead>
                    <TableHead>
                      {t('catalog:recipes.detail.table.ipn')}
                    </TableHead>
                    <TableHead>
                      {t('catalog:recipes.detail.table.quantityPerRecipe')}
                    </TableHead>
                    <TableHead>
                      {t('catalog:recipes.detail.table.unit')}
                    </TableHead>
                    <TableHead>
                      {t('catalog:recipes.detail.table.note')}
                    </TableHead>
                    <TableHead>{t('catalog:common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {record.ingredients.map((ingredient) =>
                    ingredient.kind === 'item' ? (
                      <TableRow key={ingredient.uuid}>
                        <TableCell>{ingredient.item.name}</TableCell>
                        <TableCell>
                          {t('catalog:recipes.detail.typeItem')}
                        </TableCell>
                        <TableCell>{ingredient.item.ipn || '—'}</TableCell>
                        <TableCell>{ingredient.quantity}</TableCell>
                        <TableCell>
                          {ingredient.item.units ||
                            t('catalog:recipes.detail.unresolved')}
                        </TableCell>
                        <TableCell>{ingredient.note || '—'}</TableCell>
                        <TableCell>
                          <Link
                            {...organizationLocation(
                              organizationSlug,
                              branchUuid,
                              '/settings/items/$itemId',
                              { itemId: ingredient.item.uuid }
                            )}
                            aria-label={t(
                              'catalog:recipes.detail.itemDetails',
                              {
                                name: ingredient.item.name,
                              }
                            )}
                            className='inline-flex items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                          >
                            {t('catalog:common.details')}
                          </Link>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={ingredient.uuid}>
                        <TableCell>{ingredient.recipe.name}</TableCell>
                        <TableCell>
                          {ingredient.recipe.scope !== 'local' &&
                          !ingredient.recipe.sourceRecipeActive
                            ? t(
                                'catalog:recipes.detail.typeRecipeCompanyDisabled',
                                { version: ingredient.recipe.version }
                              )
                            : ingredient.recipe.active
                              ? t('catalog:recipes.detail.typeRecipe', {
                                  version: ingredient.recipe.version,
                                })
                              : t('catalog:recipes.detail.typeRecipeInactive', {
                                  version: ingredient.recipe.version,
                                })}
                        </TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>{ingredient.quantity}</TableCell>
                        <TableCell>
                          {t('catalog:recipes.detail.recipeUnits')}
                        </TableCell>
                        <TableCell>{ingredient.note || '—'}</TableCell>
                        <TableCell>
                          <Link
                            {...organizationLocation(
                              organizationSlug,
                              branchUuid,
                              '/settings/recipes/$recipeId',
                              { recipeId: ingredient.recipe.uuid }
                            )}
                            aria-label={t(
                              'catalog:recipes.detail.recipeDetails',
                              { name: ingredient.recipe.name }
                            )}
                            className='inline-flex items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                          >
                            {t('catalog:common.details')}
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                  {record.ingredients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        {t('catalog:recipes.detail.emptyIngredients')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </section>
          </>
        )}
      </section>
      {sheetDraft && sheetDraft.record.uuid === uuid && (
        <RecipeSheet
          key={sheetDraft.key}
          recipe={sheetDraft.record}
          variant={sheetDraft.mode}
          showActive={sheetDraft.record.scope !== 'customized'}
          sourceLabel={
            sheetDraft.mode === 'customize'
              ? t('catalog:recipes.sheet.sourceCustomize', {
                  version: sheetDraft.record.version,
                })
              : sheetDraft.record.scope === 'customized'
                ? t('catalog:recipes.sheet.sourceCustomized', {
                    version: sheetDraft.record.version,
                    sourceVersion: sheetDraft.record.sourceVersion ?? '—',
                  })
                : t('catalog:recipes.sheet.sourceLocal', {
                    version: sheetDraft.record.version,
                  })
          }
          pending={write.isPending}
          error={write.error}
          onClose={() => {
            setSheetDraft(null)
            const failed = write.isError
            write.reset()
            if (failed)
              void client.invalidateQueries({
                queryKey: ['recipe', scopeKey, 'detail', uuid],
              })
          }}
          onReload={() => void reloadDraft()}
          onSubmit={submitDraft}
        />
      )}
      <ConfirmDialog
        open={confirm?.kind === 'reset'}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null)
            write.reset()
          }
        }}
        title={t('catalog:recipes.resetDialog.title')}
        desc={
          confirm?.kind === 'reset'
            ? t('catalog:recipes.resetDialog.description', {
                name: confirm.name,
                version: confirm.version,
              })
            : ''
        }
        confirmText={t('catalog:recipes.resetDialog.confirm')}
        destructive
        disabled={write.isError}
        isLoading={write.isPending}
        handleConfirm={() => {
          if (confirm?.kind === 'reset' && record !== undefined)
            write.mutate({
              kind: 'reset',
              captured: captureBranchScope(branchUuid),
              uuid: record.uuid,
              version: confirm.version,
              customizationUuid: confirm.customizationUuid,
            })
        }}
      >
        {write.isError && (
          <p role='alert' className='text-sm text-destructive'>
            {errorMessage(write.error)} {t('catalog:recipes.detail.retryHint')}
          </p>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null)
            deletion.reset()
          }
        }}
        title={t('catalog:recipes.deleteDialog.title')}
        desc={
          confirm?.kind === 'delete'
            ? t('catalog:recipes.deleteDialog.description', {
                name: confirm.name,
              })
            : ''
        }
        confirmText={t('catalog:recipes.deleteDialog.confirm')}
        destructive
        disabled={deletion.isError}
        isLoading={deletion.isPending}
        handleConfirm={() => {
          if (confirm?.kind === 'delete' && record !== undefined)
            deletion.mutate({
              uuid: record.uuid,
              version: confirm.version,
              captured: captureBranchScope(branchUuid),
            })
        }}
      >
        {deletion.isError && (
          <p role='alert' className='text-sm text-destructive'>
            {errorMessage(deletion.error)}{' '}
            {t('catalog:recipes.detail.retryHint')}
          </p>
        )}
      </ConfirmDialog>
    </>
  )
}
