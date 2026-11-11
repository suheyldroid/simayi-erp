import { queryOptions } from '@tanstack/react-query'
import type { OrganizationRecord } from '@/features/organization/model'
import { dashboardApi } from './api'

/**
 * Stable dependency for the personal summary: native membership ids plus
 * canonical slugs. Creating, leaving or renaming an organization changes this
 * string, so the summary refetches from the same membership invalidation that
 * refreshes the organization cards. Roles never matter here.
 */
export function membershipSignature(organizations: OrganizationRecord[]) {
  if (organizations.length === 0) return 'empty'
  return organizations
    .map((organization) => `${organization.id}:${organization.slug}`)
    .sort()
    .join('|')
}

/**
 * Platform-admin aggregate query. The key carries the current account id and
 * mode so a different signed-in account can never read a cached response.
 */
export function systemDashboardQueryOptions(userId: string) {
  return queryOptions({
    queryKey: ['dashboard', 'system', userId] as const,
    queryFn: () => dashboardApi.system(),
    staleTime: 60_000,
  })
}

/**
 * Current-account aggregate query. The key carries the account id, mode and
 * membership signature; the active organization is deliberately absent.
 */
export function personalDashboardQueryOptions(
  userId: string,
  membershipKey: string,
  enabled: boolean
) {
  return queryOptions({
    queryKey: ['dashboard', 'personal', userId, membershipKey] as const,
    queryFn: () => dashboardApi.personal(),
    enabled,
    staleTime: 30_000,
  })
}
