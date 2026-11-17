import type { QueryClient } from '@tanstack/react-query'
import type { CapturedBranchScope } from '@/lib/branch-scope'

/**
 * Company catalog invalidation. Item identity, categories, unit references and
 * every item picker are company-scoped; balances and stock history are not
 * part of this scope. Callers pass the scope captured for their mutation, so
 * settlement never derives a different organization's cache.
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
  ])
}

/**
 * Branch balance/history invalidation. Always use the scope captured when the
 * draft or mutation was opened, never the current selector: a settlement that
 * lands after a branch switch must not touch the new branch's cache.
 *
 * A branch write also stale-proofs the same company's all-branches aggregate
 * (`<org>::company`), derived from the captured organization scope. Otherwise
 * a branch mutation followed by a return to the company stock page would keep
 * serving the pre-mutation aggregate within its stale time. The aggregate is
 * never derived from the ambient organization, so a settlement that lands
 * after an organization switch cannot touch another tenant's cache.
 */
export async function invalidateBranchStockCaches(
  client: Pick<QueryClient, 'invalidateQueries'>,
  captured: CapturedBranchScope
) {
  const companyScope = `${captured.organizationScope}::company`
  await Promise.all([
    client.invalidateQueries({ queryKey: ['stock', captured.scope] }),
    client.invalidateQueries({ queryKey: ['stock', companyScope] }),
  ])
}
