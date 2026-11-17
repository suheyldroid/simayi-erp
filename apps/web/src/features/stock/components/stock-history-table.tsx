import { t } from '@/lib/i18n'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { StockTrackingEntry } from '../model'

const stockHistoryLabels: Record<number, string> = {
  1: t('catalog:stock.history.events.created'),
  5: t('catalog:stock.history.events.edited'),
  6: t('catalog:stock.history.events.serialAssigned'),
  10: t('catalog:stock.history.events.counted'),
  11: t('catalog:stock.history.events.added'),
  12: t('catalog:stock.history.events.removed'),
  20: t('catalog:stock.history.events.moved'),
  70: t('catalog:stock.history.events.purchaseReceipt'),
  71: t('catalog:stock.history.events.purchaseReversal'),
  90: t('catalog:stock.history.events.migrationBaseline'),
}

export function StockHistoryTable({ rows }: { rows: StockTrackingEntry[] }) {
  return (
    <Table>
      <caption className='sr-only'>
        {t('catalog:stock.history.caption')}
      </caption>
      <TableHeader>
        <TableRow>
          <TableHead>{t('catalog:stock.history.when')}</TableHead>
          <TableHead>{t('catalog:stock.history.event')}</TableHead>
          <TableHead>{t('catalog:stock.history.before')}</TableHead>
          <TableHead>{t('catalog:stock.history.after')}</TableHead>
          <TableHead>{t('catalog:stock.history.unit')}</TableHead>
          <TableHead>{t('catalog:stock.history.notes')}</TableHead>
          <TableHead>{t('catalog:stock.history.context')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.uuid}>
            <TableCell>{row.date.replace('T', ' ').slice(0, 19)}</TableCell>
            <TableCell>
              {stockHistoryLabels[row.trackingType] ?? row.trackingType}
            </TableCell>
            <TableCell>{row.quantityBefore ?? '—'}</TableCell>
            <TableCell>{row.quantityAfter ?? '—'}</TableCell>
            <TableCell>
              {row.unitCode ?? t('catalog:stock.history.unknownUnit')}
            </TableCell>
            <TableCell>{row.notes ?? '—'}</TableCell>
            <TableCell>
              {row.deltas != null && Object.keys(row.deltas).length > 0 ? (
                <details>
                  <summary className='cursor-pointer text-sm'>
                    {t('catalog:stock.history.details')}
                  </summary>
                  <pre className='mt-1 max-w-xs overflow-x-auto text-xs whitespace-pre-wrap'>
                    {JSON.stringify(row.deltas, null, 2)}
                  </pre>
                </details>
              ) : (
                '—'
              )}
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={7}>
              {t('catalog:stock.history.empty')}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
