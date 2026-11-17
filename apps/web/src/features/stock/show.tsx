import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useOptionalBranch } from '@/lib/branch-boundary'
import { t } from '@/lib/i18n'
import {
  organizationLocation,
  useOrganizationResourceParams,
} from '@/lib/organization-navigation'
import { parseResourceUuid } from '@/lib/resource-uuid'
import { Button } from '@/components/ui/button'
import { BranchRequired } from '@/components/layout/branch-gate'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { errorMessage, stockApi } from './api'
import { branchStockBalanceKey } from './cache'
import { ItemStockPanel } from './components/stock-panel'

export function StockShow() {
  const { itemId, organizationSlug } = useOrganizationResourceParams()
  const context = useOptionalBranch()
  const uuid = parseResourceUuid(itemId ?? '')
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <Link
            {...organizationLocation(
              organizationSlug,
              context?.branchUuid ?? null,
              '/stock'
            )}
            className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            {t('catalog:stock.show.back')}
          </Link>
          <h1 className='mt-2 text-2xl font-bold'>
            {context
              ? t('catalog:stock.show.title', { branch: context.branch.name })
              : t('catalog:stock.show.titlePlain')}
          </h1>
        </div>
        {uuid === null ? (
          <p role='alert'>{t('catalog:stock.show.notFound')}</p>
        ) : context == null ? (
          <BranchRequired
            description={t('catalog:stock.panel.noBranchDescription')}
          />
        ) : (
          <StockDetail
            key={`${context.branch.uuid}:${uuid}`}
            itemUuid={uuid}
            branch={context.branch}
            organizationSlug={organizationSlug}
          />
        )}
      </Main>
    </>
  )
}

function StockDetail({
  itemUuid,
  branch,
  organizationSlug,
}: {
  itemUuid: string
  branch: { uuid: string; name: string; active: boolean }
  organizationSlug: string
}) {
  const balance = useQuery({
    queryKey: branchStockBalanceKey(branch.uuid, itemUuid),
    queryFn: () => stockApi.balance(itemUuid, branch.uuid),
    refetchOnWindowFocus: false,
  })
  const detailStatus =
    balance.error && axios.isAxiosError(balance.error)
      ? balance.error.response?.status
      : undefined
  const record = balance.data
  return (
    <>
      {balance.isPending && (
        <p role='status'>{t('catalog:stock.show.loading')}</p>
      )}
      {balance.isError && detailStatus === 404 && (
        <p role='alert'>{t('catalog:stock.show.notFound')}</p>
      )}
      {balance.isError && detailStatus !== 404 && (
        <p role='alert'>
          {errorMessage(balance.error)}{' '}
          <Button variant='outline' onClick={() => void balance.refetch()}>
            {t('catalog:common.retry')}
          </Button>
        </p>
      )}
      {record && (
        <>
          <section className='space-y-4 rounded-md border border-border p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <h2 className='text-xl font-semibold'>{record.name}</h2>
                <p className='text-sm text-muted-foreground'>
                  {[
                    t('catalog:stock.show.idLine', { uuid: record.itemUuid }),
                    record.ipn
                      ? t('catalog:stock.show.ipn', { ipn: record.ipn })
                      : null,
                    record.category ? record.category.pathstring : null,
                  ]
                    .filter((part) => part !== null)
                    .join(' · ')}
                </p>
              </div>
              <Link
                {...organizationLocation(
                  organizationSlug,
                  branch.uuid,
                  '/settings/items/$itemId',
                  { itemId: record.itemUuid }
                )}
                className='rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
              >
                {t('catalog:stock.show.openItem')}
              </Link>
            </div>
            <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
              <dt>{t('catalog:stock.columns.category')}</dt>
              <dd>
                {record.category ? (
                  <Link
                    {...organizationLocation(
                      organizationSlug,
                      branch.uuid,
                      '/settings/item-categories/$categoryId',
                      { categoryId: record.category.uuid }
                    )}
                    className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                  >
                    {record.category.pathstring}
                  </Link>
                ) : (
                  '—'
                )}
              </dd>
              <dt>{t('catalog:stock.columns.unit')}</dt>
              <dd>
                {record.unit
                  ? `${record.unit.name} · ${record.unit.code}`
                  : record.units || t('catalog:stock.show.unresolvedLegacy')}
                {record.unit && !record.unit.active
                  ? t('catalog:stock.show.inactiveSuffix')
                  : null}
              </dd>
              <dt>{t('catalog:stock.show.catalogStatus')}</dt>
              <dd>
                {record.active
                  ? t('catalog:common.active')
                  : t('catalog:common.inactive')}
              </dd>
            </dl>
          </section>
          <ItemStockPanel itemUuid={record.itemUuid} branch={branch} />
        </>
      )}
    </>
  )
}
