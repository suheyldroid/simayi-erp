import type { QueryClient } from '@tanstack/react-query'
import { t } from '@/lib/i18n'
import { organizationCacheScope } from '@/lib/tenant'

declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * Branch scope for a branch-sensitive request. Required by `branchApi`;
     * rejected when absent so a branch call can never silently run without a
     * verified branch.
     */
    branchUuid?: string
  }
}

/**
 * Optional branch transport header. Only branch-scoped requests carry it; the
 * company and global clients never read the selected branch.
 */
export const BRANCH_HEADER = 'x-branch-id'

let activeBranchUuid: string | null = null
let activeScope: string | null = null
let branchRequests = new AbortController()
let queryClient: Pick<QueryClient, 'cancelQueries'> | null = null

export function registerBranchQueryClient(
  client: Pick<QueryClient, 'cancelQueries'>
) {
  queryClient = client
}

/**
 * Branch cache identity. It always includes the organization scope, so the
 * same branch UUID in another company can never share a cache entry. `null`
 * is a real Company scope, distinct from any branch.
 */
export function branchCacheScope(branchUuid: string | null): string {
  return `${organizationCacheScope()}::${branchUuid ?? 'company'}`
}

export type CapturedBranchScope = {
  organizationScope: string
  branchUuid: string | null
  scope: string
}

/**
 * Capture the scope a draft or mutation belongs to. Settlement must use this
 * captured scope; it must never re-read the selector.
 */
export function captureBranchScope(
  branchUuid: string | null
): CapturedBranchScope {
  return {
    organizationScope: organizationCacheScope(),
    branchUuid,
    scope: branchCacheScope(branchUuid),
  }
}

export function isBranchScopeCurrent(captured: CapturedBranchScope): boolean {
  return (
    captured.organizationScope === organizationCacheScope() &&
    captured.branchUuid === activeBranchUuid &&
    captured.scope === activeScope
  )
}

export function assertBranchScope(captured: CapturedBranchScope): void {
  if (isBranchScopeCurrent(captured)) return
  throw new Error(t('common:errors.branchScopeChanged'))
}

/** Aborted on every branch transition; branch requests subscribe to it. */
export function getBranchRequestSignal(): AbortSignal {
  return branchRequests.signal
}

/**
 * Move the verified selection to `branchUuid` (`null` = Company). A change
 * aborts in-flight branch requests and cancels branch-scoped queries of the
 * previous scope before descendants re-render, so stale data can never land in
 * the new selection.
 */
export function setActiveBranch(branchUuid: string | null): void {
  const scope = branchCacheScope(branchUuid)
  if (activeScope === scope) {
    activeBranchUuid = branchUuid
    return
  }

  const previousScope = activeScope
  activeBranchUuid = branchUuid
  activeScope = scope

  branchRequests.abort()
  branchRequests = new AbortController()

  if (previousScope && queryClient) {
    void queryClient.cancelQueries({
      predicate: (query) => query.queryKey.includes(previousScope),
    })
  }
}
