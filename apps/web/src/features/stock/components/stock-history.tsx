import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, stockApi } from '../api'
import { StockHistoryTable } from './stock-history-table'

export function ItemStockHistory({ itemUuid }: { itemUuid: string }) {
  const [page, setPage] = useState(0)
  const entries = useQuery({
    queryKey: ['stock', organizationCacheScope(), 'tracking', itemUuid, page],
    queryFn: () => stockApi.tracking(itemUuid, page),
    refetchOnWindowFocus: false,
  })
  return (
    <div className='space-y-3'>
      {entries.isPending && <p role='status'>Loading history…</p>}
      {entries.isError && (
        <p role='alert'>
          {errorMessage(entries.error)}{' '}
          <Button variant='outline' onClick={() => void entries.refetch()}>
            Retry
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
