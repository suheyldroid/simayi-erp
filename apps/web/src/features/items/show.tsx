import { useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { invalidateItemStockCaches } from '@/lib/item-stock-cache'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { parseResourceUuid } from '@/lib/resource-uuid'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ItemStockPanel } from '@/features/stock/components/stock-panel'
import { errorMessage, itemApi } from './api'
import { ItemForm } from './components/item-form'
import type { Item } from './model'

const itemRoute = getRouteApi(
  '/_authenticated/o/$organizationSlug/settings/items/$itemId'
)

const itemLabel = (item: Item) => item.name || item.ipn || 'Item'

function EditItemAction({ item }: { item: Item }) {
  const [draft, setDraft] = useState<Item | null>(null)
  return (
    <>
      <Button type='button' variant='outline' onClick={() => setDraft(item)}>
        Edit
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
  const [target, setTarget] = useState<Item | null>(null)
  const deletion = useMutation({
    mutationFn: (input: { uuid: string; scope: string }) =>
      itemApi.removeItem(input.uuid),
    onSuccess: async (_data, input) => {
      await invalidateItemStockCaches(client, input.scope)
      await client.invalidateQueries({ queryKey: ['item-category'] })
      setTarget(null)
      toast.success('Item deleted')
      await navigate({
        to: '/o/$organizationSlug/settings/items',
        params: { organizationSlug },
      })
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
        Delete
      </Button>
      <ConfirmDialog
        open={target != null}
        onOpenChange={(open) => {
          if (!open) setTarget(null)
        }}
        title='Delete item'
        desc='This permanently deletes the item. Items used by a recipe cannot be deleted.'
        confirmText='Delete'
        destructive
        isLoading={deletion.isPending}
        handleConfirm={() => {
          if (target)
            deletion.mutate({
              uuid: target.uuid,
              scope: organizationCacheScope(),
            })
        }}
      />
    </>
  )
}

export function ItemDetail() {
  const { itemId } = itemRoute.useParams()
  const organizationSlug = useOrganizationSlug()
  const uuid = parseResourceUuid(itemId)
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
          to='/o/$organizationSlug/settings/items'
          params={{ organizationSlug }}
          className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
        >
          Back to items
        </Link>
        <h2 className='mt-2 text-2xl font-bold'>
          {liveItem ? itemLabel(liveItem) : 'Item details'}
        </h2>
      </div>
      {uuid === null && <p role='alert'>Item not found.</p>}
      {uuid !== null && details.isPending && <p role='status'>Loading item…</p>}
      {details.isError && detailStatus === 404 && (
        <p role='alert'>Item not found.</p>
      )}
      {details.isError && detailStatus !== 404 && (
        <p role='alert'>
          Could not load this item.{' '}
          <Button variant='outline' onClick={() => void details.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {liveItem && item && !details.isError && (
        <>
          <section className='space-y-4 rounded-md border border-border p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <h3 className='text-xl font-semibold'>Item details</h3>
                <p className='text-sm text-muted-foreground'>
                  ID {item.uuid}
                  {item.ipn ? ` · IPN ${item.ipn}` : ''}
                  {item.category ? ` · ${item.category.pathstring}` : ''}
                  {` · version ${item.version}`}
                </p>
              </div>
              <div className='flex flex-wrap gap-2'>
                <EditItemAction
                  key={`edit-${organizationSlug}-${item.uuid}`}
                  item={item}
                />
                <DeleteItemAction
                  key={`delete-${organizationSlug}-${item.uuid}`}
                  item={item}
                  organizationSlug={organizationSlug}
                />
              </div>
            </div>
            {item.description && <p className='text-sm'>{item.description}</p>}
            <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
              <dt>Category</dt>
              <dd>
                {item.category ? (
                  <Link
                    to='/o/$organizationSlug/settings/item-categories/$categoryId'
                    params={{
                      organizationSlug,
                      categoryId: item.category.uuid,
                    }}
                    className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                  >
                    {item.category.pathstring}
                  </Link>
                ) : (
                  '—'
                )}
              </dd>
              <dt>Unit</dt>
              <dd>
                {item.unit ? (
                  <span>
                    {item.unit.name} · {item.unit.code}
                  </span>
                ) : item.units ? (
                  item.units
                ) : (
                  'Unresolved (legacy)'
                )}
                {item.unit && !item.unit.active ? ' · inactive' : null}
              </dd>
              <dt>Minimum stock</dt>
              <dd>{item.minimumStock}</dd>
              <dt>Default expiry</dt>
              <dd>{item.defaultExpiry} days</dd>
              <dt>Image</dt>
              <dd className='break-all'>{item.image || '—'}</dd>
              <dt>Status</dt>
              <dd>{item.active ? 'Active' : 'Inactive'}</dd>
              <dt>Created</dt>
              <dd>
                {item.creationDate
                  ? new Date(item.creationDate).toLocaleDateString()
                  : '—'}
              </dd>
            </dl>
          </section>
          <section className='space-y-4'>
            <h3 className='text-xl font-semibold'>Stock</h3>
            <ItemStockPanel key={item.uuid} item={item} />
          </section>
        </>
      )}
    </section>
  )
}
