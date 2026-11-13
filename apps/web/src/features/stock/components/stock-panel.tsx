import type { Item } from '@/features/items/model'
import { ItemStockActions } from './stock-actions'
import { ItemStockHistory } from './stock-history'

export function ItemStockPanel({ item }: { item: Item }) {
  return (
    <div className='space-y-4'>
      <section className='space-y-1 rounded-md border border-border p-4'>
        <p className='text-sm text-muted-foreground'>Current stock</p>
        <p className='text-2xl font-semibold'>
          {item.stock}
          {item.units ? ` ${item.units}` : ' · unit unresolved'}
        </p>
        <p className='text-sm text-muted-foreground'>
          Minimum {item.minimumStock} · version {item.version}
        </p>
      </section>
      <ItemStockActions item={item} />
      <section className='space-y-2'>
        <h3 className='font-medium'>Stock history</h3>
        <ItemStockHistory itemUuid={item.uuid} />
      </section>
    </div>
  )
}
