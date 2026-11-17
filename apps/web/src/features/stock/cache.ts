import { branchCacheScope } from '@/lib/branch-scope'

/**
 * Stock cache identity. Every list, balance and history key carries the
 * shared scope (company scope plus branch UUID, or the company marker), so
 * switching branch can never read the previous branch's data.
 */
export function branchStockKey(branchUuid: string | null) {
  return ['stock', branchCacheScope(branchUuid)] as const
}

export function branchStockListKey(branchUuid: string | null) {
  return [...branchStockKey(branchUuid), 'list'] as const
}

export function branchStockBalanceKey(branchUuid: string, itemUuid: string) {
  return [...branchStockKey(branchUuid), 'balance', itemUuid] as const
}

export function branchStockTrackingKey(
  branchUuid: string,
  itemUuid: string,
  page: number
) {
  return [...branchStockKey(branchUuid), 'tracking', itemUuid, page] as const
}
