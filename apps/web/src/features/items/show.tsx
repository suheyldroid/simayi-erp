import { useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOptionalBranch } from '@/lib/branch-boundary'
import { captureBranchScope, isBranchScopeCurrent } from '@/lib/branch-scope'
import { locale, t } from '@/lib/i18n'
import { invalidateItemStockCaches } from '@/lib/item-stock-cache'
import {
  organizationLocation,
  useOrganizationResourceParams,
  useOrganizationScope,
} from '@/lib/organization-navigation'
import { parseResourceUuid } from '@/lib/resource-uuid'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ItemStockPanel } from '@/features/stock/components/stock-panel'
import { errorMessage, itemApi } from './api'
import { ItemForm } from './components/item-form'
import type { Item } from './model'

const itemLabel = (item: Item) =>
  item.name || item.ipn || t('catalog:items.fallbackName')

function EditItemAction({ item }: { item: Item }) {
  const [draft, setDraft] = useState<Item | null>(null)
  return (
    <>
      <Button type='button' variant='outline' onClick={() => setDraft(item)}>
        {t('catalog:common.edit')}
      </Button>
      <ItemForm
        draft={draft ? { mode: 'edit', item: draft } : null}
        canSubmit={draft != null}
        onOpenChange={(open) => {
          if (!open) setDraft(null)
        }}
      />
    </>
  )
}

function DeleteItemAction({
  item,
  organizationSlug,
}: {
  item: Item
  organizationSlug: string
}) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const { branchUuid } = useOrganizationScope()
  const [target, setTarget] = useState<Item | null>(null)
  const deletion = useMutation({
    mutationFn: (input: { uuid: string; scope: string }) =>
      itemApi.removeItem(input.uuid),
    onSuccess: async (_data, input) => {
      await invalidateItemStockCaches(client, input.scope)
      // Branch balances embed the shared item identity, so every branch stock
      // view of this company is refreshed after the catalog deletion.
      await client.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'stock' &&
          typeof query.queryKey[1] === 'string' &&
          query.queryKey[1].startsWith(`${input.scope}::`),
      })
      await client.invalidateQueries({ queryKey: ['item-category'] })
      setTarget(null)
      toast.success(t('catalog:items.deletedToast'))
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <>
      <Button
        type='button'
        variant='outline'
        disabled={deletion.isPending}
        onClick={() => setTarget(item)}
      >
        {t('catalog:common.delete')}
      </Button>
      <ConfirmDialog
        open={target != null}
        onOpenChange={(open) => {
          if (!open) setTarget(null)
        }}
        title={t('catalog:items.deleteTitle')}
        desc={t('catalog:items.deleteDescription')}
        confirmText={t('catalog:common.delete')}
        destructive
        isLoading={deletion.isPending}
        handleConfirm={() => {
          if (!target) return
          const ui = captureBranchScope(branchUuid)
          deletion.mutate(
            { uuid: target.uuid, scope: organizationCacheScope() },
            {
              onSuccess: () => {
                // The catalog write is not aborted by a scope switch; only the
                // scope that confirmed the deletion is redirected.
                if (!isBranchScopeCurrent(ui)) return
                void navigate(
                  organizationLocation(
                    organizationSlug,
                    ui.branchUuid,
                    '/settings/items'
                  )
                )
              },
            }
          )
        }}
      />
    </>
  )
}

export function ItemDetail() {
  const { itemId, organizationSlug, branchUuid } =
    useOrganizationResourceParams()
  const branch = useOptionalBranch()
  const uuid = parseResourceUuid(itemId ?? '')
  const details = useQuery({
    queryKey: ['item', 'items', organizationCacheScope(), 'detail', uuid],
    queryFn: () => itemApi.item(uuid as string),
    enabled: uuid != null,
  })
  const detailStatus =
    details.error && axios.isAxiosError(details.error)
      ? details.error.response?.status
      : undefined
  const item = details.data
  const liveItem =
    uuid !== null &&
    details.isSuccess &&
    !details.isError &&
    item != null &&
    item.uuid === uuid
      ? item
      : null
  return (
    <section className='space-y-6'>
      <div>
        <Link
          {...organizationLocation(
            organizationSlug,
            branchUuid,
            '/settings/items'
          )}
          className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
        >
          {t('catalog:items.back')}
        </Link>
        <h2 className='mt-2 text-2xl font-bold'>
          {liveItem ? itemLabel(liveItem) : t('catalog:items.detailTitle')}
        </h2>
      </div>
      {uuid === null && <p role='alert'>{t('catalog:items.notFound')}</p>}
      {uuid !== null && details.isPending && (
        <p role='status'>{t('catalog:items.loadingOne')}</p>
      )}
      {details.isError && detailStatus === 404 && (
        <p role='alert'>{t('catalog:items.notFound')}</p>
      )}
      {details.isError && detailStatus !== 404 && (
        <p role='alert'>
          {t('catalog:items.loadError')}{' '}
          <Button variant='outline' onClick={() => void details.refetch()}>
            {t('catalog:common.retry')}
          </Button>
        </p>
      )}
      {liveItem && item && !details.isError && (
        <>
          <section className='space-y-4 rounded-md border border-border p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <h3 className='text-xl font-semibold'>
                  {t('catalog:items.detailTitle')}
                </h3>
                <p className='text-sm text-muted-foreground'>
                  {[
                    t('catalog:items.meta.id', { uuid: item.uuid }),
                    item.ipn
                      ? t('catalog:items.meta.ipn', { ipn: item.ipn })
                      : null,
                    item.category ? item.category.pathstring : null,
                    t('catalog:items.meta.version', { version: item.version }),
                  ]
                    .filter((part) => part !== null)
                    .join(' · ')}
                </p>
              </div>
              <div className='flex flex-wrap gap-2'>
                <EditItemAction
                  key={`edit-${organizationSlug}-${item.uuid}`}
                  item={item}
                />
                {!item.hasReceipts && (
                  <DeleteItemAction
                    key={`delete-${organizationSlug}-${item.uuid}`}
                    item={item}
                    organizationSlug={organizationSlug}
                  />
                )}
              </div>
            </div>
            {item.description && <p className='text-sm'>{item.description}</p>}
            {item.hasReceipts && (
              <p className='text-sm text-muted-foreground'>
                {t('catalog:items.receiptsLock')}
              </p>
            )}
            <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
              <dt>{t('catalog:items.fields.category')}</dt>
              <dd>
                {item.category ? (
                  <Link
                    {...organizationLocation(
                      organizationSlug,
                      branchUuid,
                      '/settings/item-categories/$categoryId',
                      { categoryId: item.category.uuid }
                    )}
                    className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                  >
                    {item.category.pathstring}
                  </Link>
                ) : (
                  '—'
                )}
              </dd>
              <dt>{t('catalog:items.fields.unit')}</dt>
              <dd>
                {item.unit ? (
                  <span>
                    {item.unit.name} · {item.unit.code}
                  </span>
                ) : item.units ? (
                  item.units
                ) : (
                  t('catalog:items.unresolvedLegacy')
                )}
                {item.unit && !item.unit.active
                  ? t('catalog:items.inactiveSuffix')
                  : null}
              </dd>
              <dt>{t('catalog:items.fields.defaultExpiry')}</dt>
              <dd>
                {t('catalog:items.expiryDays', {
                  days: item.defaultExpiry.toLocaleString(locale),
                })}
              </dd>
              <dt>{t('catalog:items.fields.image')}</dt>
              <dd className='break-all'>{item.image || '—'}</dd>
              <dt>{t('catalog:items.fields.status')}</dt>
              <dd>
                {item.active
                  ? t('catalog:common.active')
                  : t('catalog:common.inactive')}
              </dd>
              <dt>{t('catalog:items.fields.created')}</dt>
              <dd>
                {item.creationDate
                  ? new Date(item.creationDate).toLocaleDateString(locale)
                  : '—'}
              </dd>
            </dl>
          </section>
          <section className='space-y-4'>
            <h3 className='text-xl font-semibold'>
              {t('catalog:items.stockHeading')}
            </h3>
            <ItemStockPanel
              itemUuid={item.uuid}
              branch={branch == null ? null : branch.branch}
            />
          </section>
        </>
      )}
    </section>
  )
}
