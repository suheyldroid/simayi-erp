import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { parseResourceUuid } from '@/lib/resource-uuid'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { errorMessage, itemApi } from '@/features/items/api'
import type { Item } from '@/features/items/model'
import { ItemStockPanel } from './components/stock-panel'

const stockRoute = getRouteApi(
  '/_authenticated/o/$organizationSlug/_workspace/stock/$itemId'
)

const itemLabel = (item: Item) => item.name || item.ipn || 'Item'

export function StockShow() {
  const { itemId } = stockRoute.useParams()
  const organizationSlug = useOrganizationSlug()
  const uuid = parseResourceUuid(itemId)
  const details = useQuery({
    queryKey: ['item', 'items', organizationCacheScope(), 'detail', uuid],
    queryFn: () => itemApi.item(uuid as string),
    enabled: uuid !== null,
    refetchOnWindowFocus: false,
  })
  const detailStatus =
    details.error && axios.isAxiosError(details.error)
      ? details.error.response?.status
      : undefined
  const item =
    uuid !== null &&
    details.isSuccess &&
    !details.isError &&
    details.data != null &&
    details.data.uuid === uuid
      ? details.data
      : null
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <Link
            to='/o/$organizationSlug/stock'
            params={{ organizationSlug }}
            className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            Back to stock
          </Link>
          <h1 className='mt-2 text-2xl font-bold'>
            {item ? itemLabel(item) : 'Stock'}
          </h1>
        </div>
        {uuid === null && <p role='alert'>Item not found.</p>}
        {uuid !== null && details.isPending && (
          <p role='status'>Loading stock…</p>
        )}
        {details.isError && detailStatus === 404 && (
          <p role='alert'>Item not found.</p>
        )}
        {details.isError && detailStatus !== 404 && (
          <p role='alert'>
            {errorMessage(details.error)}{' '}
            <Button variant='outline' onClick={() => void details.refetch()}>
              Retry
            </Button>
          </p>
        )}
        {item && (
          <>
            <section className='space-y-4 rounded-md border border-border p-4'>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <h2 className='text-xl font-semibold'>Item</h2>
                  <p className='text-sm text-muted-foreground'>
                    UUID {item.uuid}
                    {item.ipn ? ` · IPN ${item.ipn}` : ''}
                    {` · version ${item.version}`}
                  </p>
                </div>
                <Link
                  to='/o/$organizationSlug/settings/items/$itemId'
                  params={{
                    organizationSlug,
                    itemId: item.uuid,
                  }}
                  className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                >
                  Open item record
                </Link>
              </div>
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
                <dt>Units</dt>
                <dd>{item.units || '—'}</dd>
                <dt>Minimum stock</dt>
                <dd>{item.minimumStock}</dd>
                <dt>Status</dt>
                <dd>{item.active ? 'Active' : 'Inactive'}</dd>
              </dl>
            </section>
            <section className='space-y-4'>
              <h2 className='text-xl font-semibold'>Stock</h2>
              <ItemStockPanel key={item.uuid} item={item} />
            </section>
          </>
        )}
      </Main>
    </>
  )
}
