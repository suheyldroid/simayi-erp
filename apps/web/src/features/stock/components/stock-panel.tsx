import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { errorMessage, stockApi } from '../api'
import { branchStockBalanceKey } from '../cache'
import { ItemStockActions } from './stock-actions'
import { ItemStockHistory } from './stock-history'
import { StockMinimumSheet } from './stock-minimum'

export type BranchStockContext = {
  uuid: string
  name: string
  active: boolean
}

/**
 * One branch's balance for one catalog item. Company context has no balance:
 * the panel never falls back to a company-wide zero or a shared item figure.
 */
export function ItemStockPanel({
  itemUuid,
  branch,
}: {
  itemUuid: string
  branch: BranchStockContext | null
}) {
  const [editingMinimum, setEditingMinimum] = useState(false)
  if (branch === null)
    return (
      <section className='space-y-1 rounded-md border border-border p-4'>
        <p className='text-sm font-medium'>
          {t('catalog:stock.panel.noBranchTitle')}
        </p>
        <p className='text-sm text-muted-foreground'>
          {t('catalog:stock.panel.noBranchDescription')}
        </p>
      </section>
    )
  return (
    <BranchStockPanel
      key={`${branch.uuid}:${itemUuid}`}
      itemUuid={itemUuid}
      branch={branch}
      editingMinimum={editingMinimum}
      onEditingMinimumChange={setEditingMinimum}
    />
  )
}

function BranchStockPanel({
  itemUuid,
  branch,
  editingMinimum,
  onEditingMinimumChange,
}: {
  itemUuid: string
  branch: BranchStockContext
  editingMinimum: boolean
  onEditingMinimumChange: (open: boolean) => void
}) {
  const balance = useQuery({
    queryKey: branchStockBalanceKey(branch.uuid, itemUuid),
    queryFn: () => stockApi.balance(itemUuid, branch.uuid),
    refetchOnWindowFocus: false,
  })
  const record = balance.data
  return (
    <div className='space-y-4'>
      <section className='space-y-1 rounded-md border border-border p-4'>
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <div className='space-y-1'>
            <p className='text-sm text-muted-foreground'>
              {t('catalog:stock.panel.currentStock', { branch: branch.name })}
              {branch.active
                ? ''
                : t('catalog:stock.panel.inactiveBranchSuffix')}
            </p>
            {record ? (
              <>
                <p className='text-2xl font-semibold'>
                  {record.stock}
                  {record.units
                    ? ` ${record.units}`
                    : t('catalog:stock.panel.unitUnresolvedSuffix')}
                </p>
                <p className='text-sm text-muted-foreground'>
                  {t('catalog:stock.panel.minimumLine', {
                    minimum: record.minimumStock,
                    version: record.version,
                  })}
                </p>
                {record.belowMinimum && (
                  <p className='text-sm text-destructive'>
                    {t('catalog:stock.panel.belowMinimum')}
                  </p>
                )}
              </>
            ) : (
              <p role='status'>
                {balance.isError
                  ? t('catalog:stock.panel.balanceUnavailable')
                  : t('catalog:stock.panel.loadingBalance')}
              </p>
            )}
          </div>
          <Button
            type='button'
            variant='outline'
            disabled={!record || !branch.active}
            onClick={() => onEditingMinimumChange(true)}
          >
            {t('catalog:stock.panel.editMinimum')}
          </Button>
        </div>
        {balance.isError && (
          <p role='alert'>
            {errorMessage(balance.error)}{' '}
            <Button variant='outline' onClick={() => void balance.refetch()}>
              {t('catalog:common.retry')}
            </Button>
          </p>
        )}
        {!branch.active && (
          <p role='alert' className='text-sm text-destructive'>
            {t('catalog:stock.panel.inactiveAlert')}
          </p>
        )}
      </section>
      {record && <ItemStockActions balance={record} branch={branch} />}
      <section className='space-y-2'>
        <h3 className='font-medium'>
          {t('catalog:stock.panel.historyHeading', { branch: branch.name })}
        </h3>
        <ItemStockHistory itemUuid={itemUuid} branchUuid={branch.uuid} />
      </section>
      {record && editingMinimum && (
        <StockMinimumSheet
          balance={record}
          branch={branch}
          onClose={() => onEditingMinimumChange(false)}
        />
      )}
    </div>
  )
}
