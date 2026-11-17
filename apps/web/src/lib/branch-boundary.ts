import { useMatch } from '@tanstack/react-router'
import { branchCacheScope } from '@/lib/branch-scope'
import { t } from '@/lib/i18n'
import type { Branch } from '@/features/branches/model'

export type BranchRecord = Branch

export type BranchContext = {
  organizationId: string
  organizationSlug: string
  branchUuid: string
  branch: BranchRecord
}

/**
 * Branch boundary route id. The `$branchUuid` path segment is the only branch
 * selection: the route resolves and verifies it before any descendant mounts,
 * so consumers never read a query value or a client-supplied header.
 */
export const BRANCH_ROUTE_ID =
  '/_authenticated/o/$organizationSlug/b/$branchUuid' as const

const ORGANIZATION_ROUTE_ID = '/_authenticated/o/$organizationSlug' as const

/**
 * Verified optional branch for the current path. The branch boundary resolved
 * `/o/<slug>/b/<uuid>` through the branch API (tenant-scoped, so a foreign UUID
 * is a 404) before any descendant mounted, and the parent slug boundary
 * verified native membership and the live session. `null` is the company scope
 * (all organization records); there is no fallback to a first branch.
 *
 * Outside the organization subtree (global/system settings) this is `null`
 * instead of throwing, so shared sidebar components can render everywhere.
 */
export function useOptionalBranch(): BranchContext | null {
  const organizationMatch = useMatch({
    from: ORGANIZATION_ROUTE_ID,
    shouldThrow: false,
  })
  const branchMatch = useMatch({
    from: BRANCH_ROUTE_ID,
    shouldThrow: false,
  })
  const branch = branchMatch?.context.branch ?? null
  const organization = organizationMatch?.context.organization ?? null
  if (!branch || !organization) return null
  return {
    organizationId: organization.id,
    organizationSlug: organization.slug,
    branchUuid: branch.uuid,
    branch,
  }
}

/**
 * Verified branch for consumers that cannot work in company scope. The
 * boundary already failed closed for malformed, unknown and foreign branches,
 * so this only throws when the caller forgot to gate the page behind a branch
 * path.
 */
export function useRequiredBranch(): BranchContext {
  const branch = useOptionalBranch()
  if (!branch) throw new Error(t('common:errors.branchRequired'))
  return branch
}

/** Alias kept for callers that prefer the boundary wording. */
export const useBranchBoundary = useRequiredBranch

export function useBranchUuid(): string | null {
  return useOptionalBranch()?.branchUuid ?? null
}

/** Branch cache namespace (company + branch), or null in company scope. */
export function useBranchScope(): string | null {
  const branchUuid = useBranchUuid()
  return branchUuid === null ? null : branchCacheScope(branchUuid)
}

/**
 * Outlet key for a shell.
 *
 * Branch-operational route prefixes intentionally remount when the branch scope
 * changes, so no branch-scoped page, sheet or draft can survive into another
 * branch. Other prefixes keep the organization key, avoiding an unnecessary
 * remount when only the route's params change.
 *
 * This key only governs remounting *within one route match*. Company and
 * branch paths are different route matches (and a branch change replaces path
 * params), so state can still be discarded by the router there; a React key is
 * not a draft-retention guarantee. Screens holding unsaved editor state must
 * add their own navigation guard instead of relying on this key.
 *
 * The comparison strips the optional `/b/<uuid>` scope segment, so the same
 * section keeps the same classification in both shells.
 */
export function branchOutletKey(input: {
  organizationId: string
  organizationSlug: string
  pathname: string
  branchUuid: string | null
  prefixes: readonly string[]
}): string {
  const root = `/o/${input.organizationSlug}`
  let relative =
    input.pathname === root
      ? ''
      : input.pathname.startsWith(`${root}/`)
        ? input.pathname.slice(root.length + 1)
        : input.pathname
  if (relative.startsWith('b/')) {
    const rest = relative.slice('b/'.length)
    const slash = rest.indexOf('/')
    relative = slash === -1 ? '' : rest.slice(slash + 1)
  }
  const branchScoped = input.prefixes.some(
    (prefix) => relative === prefix || relative.startsWith(`${prefix}/`)
  )
  return branchScoped
    ? `${input.organizationId}:${input.branchUuid ?? 'company'}`
    : input.organizationId
}
