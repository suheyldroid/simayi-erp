import { t } from '@/lib/i18n'

/**
 * Tenant header attached to business requests. Same value the backend reads in
 * its tenant actor resolution.
 */
export const ORGANIZATION_HEADER = 'x-organization-id'

let pinned: string | null | undefined
let frozen = false
let queryClient: { cancelQueries: () => Promise<void> } | null = null

export function registerOrganizationQueryClient(client: {
  cancelQueries: () => Promise<void>
}) {
  queryClient = client
}

export function getPinnedOrganizationId() {
  return pinned ?? null
}

export function organizationCacheScope() {
  return pinned ?? 'none'
}

export function isOrganizationFrozen() {
  return frozen
}

export function freezeOrganization() {
  frozen = true
}

export function unfreezeOrganization() {
  frozen = false
}

export function noteSessionOrganization(activeOrganizationId: string | null) {
  if (frozen) return 'reload' as const
  if (pinned === undefined) {
    pinned = activeOrganizationId
    return 'ok' as const
  }
  if (pinned !== activeOrganizationId) {
    frozen = true
    return 'reload' as const
  }
  return 'ok' as const
}

export function assertSameOrganization(organizationId: string) {
  if (frozen || getPinnedOrganizationId() !== organizationId)
    throw new Error(t('common:errors.organizationScopeChanged'))
}

export async function cancelOrganizationQueries() {
  await queryClient?.cancelQueries()
}
