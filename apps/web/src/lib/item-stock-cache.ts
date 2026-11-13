import type { QueryClient } from '@tanstack/react-query'

/**
 * Invalidate only the captured organization's item and stock caches: item
 * lists, item details, the item pickers (items settings, stock, and purchase
 * order lines), and stock lists/tracking. Callers pass the scope captured for
 * their mutation/draft, so settlement never derives a different organization's
 * cache.
 */
export async function invalidateItemStockCaches(
  client: Pick<QueryClient, 'invalidateQueries'>,
  scope: string
) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ['item', 'items', scope] }),
    client.invalidateQueries({ queryKey: ['item', 'items', 'select', scope] }),
    client.invalidateQueries({
      queryKey: ['item', 'items', 'purchasing', scope],
    }),
    client.invalidateQueries({ queryKey: ['stock', scope] }),
  ])
}
