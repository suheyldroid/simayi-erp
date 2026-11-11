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
  1: 'Created',
  5: 'Edited',
  6: 'Serial assigned',
  10: 'Counted',
  11: 'Added',
  12: 'Removed',
  20: 'Moved',
  70: 'Purchase receipt',
  90: 'Migration baseline',
}

export function StockHistoryTable({ rows }: { rows: StockTrackingEntry[] }) {
  return (
    <Table>
      <caption className='sr-only'>Stock balance history</caption>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Event</TableHead>
          <TableHead>Before</TableHead>
          <TableHead>After</TableHead>
          <TableHead>Notes</TableHead>
          <TableHead>Context</TableHead>
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
            <TableCell>{row.notes ?? '—'}</TableCell>
            <TableCell>
              {row.deltas != null && Object.keys(row.deltas).length > 0 ? (
                <details>
                  <summary className='cursor-pointer text-sm'>Details</summary>
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
            <TableCell colSpan={6}>No history yet.</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
