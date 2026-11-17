import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, stockApi } from '../api'
import { branchStockTrackingKey } from '../cache'
import { StockHistoryTable } from './stock-history-table'

export function ItemStockHistory({
  itemUuid,
  branchUuid,
}: {
  itemUuid: string
  branchUuid: string
}) {
  const [page, setPage] = useState(0)
  const entries = useQuery({
    queryKey: branchStockTrackingKey(branchUuid, itemUuid, page),
    queryFn: () => stockApi.tracking(itemUuid, branchUuid, page),
    refetchOnWindowFocus: false,
  })
  return (
    <div className='space-y-3'>
      {entries.isPending && (
        <p role='status'>{t('catalog:stock.panel.historyLoading')}</p>
      )}
      {entries.isError && (
        <p role='alert'>
          {errorMessage(entries.error)}{' '}
          <Button variant='outline' onClick={() => void entries.refetch()}>
            {t('catalog:common.retry')}
          </Button>
        </p>
      )}
      {entries.data && (
        <>
          <StockHistoryTable rows={entries.data.items} />
          <PageControls
            page={page}
            hasNext={(page + 1) * entries.data.limit < entries.data.total}
            loading={entries.isFetching}
            onChange={setPage}
          />
        </>
      )}
    </div>
  )
}
