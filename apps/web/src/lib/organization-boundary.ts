import { queryOptions } from '@tanstack/react-query'
import { getRouteApi, useParams } from '@tanstack/react-router'
import { t } from '@/lib/i18n'
import {
  membershipListQueryKey,
  organizationApi,
} from '@/features/organization/api'
import type { OrganizationRecord } from '@/features/organization/model'

/**
 * Native Better Auth membership list. It is global (never tenant-scoped): the
 * only source a slug is resolved against, so a URL can never name an
 * organization the account is not a member of. Shares its key with the
 * membership hooks used by the directory and switcher.
 */
export const membershipQueryOptions = queryOptions({
  queryKey: membershipListQueryKey,
  queryFn: () => organizationApi.list(),
})

const organizationRouteApi = getRouteApi('/_authenticated/o/$organizationSlug')

export type OrganizationBoundary = {
  /** Real organization id from the native membership resolved by slug. */
  organizationId: string
  /** Canonical slug from the same membership. */
  organizationSlug: string
  organization: OrganizationRecord
}

/**
 * Verified organization boundary for everything under `/o/$organizationSlug`.
 * The layout behind this hook resolved the URL slug against native memberships,
 * confirmed the live session's active organization and re-checked the current
 * membership before children mounted, so the slug/id exposed here is never a
 * client-supplied tenant header.
 */
export function useOrganizationBoundary(): OrganizationBoundary {
  const { organization, organizationSlug } =
    organizationRouteApi.useRouteContext()
  return {
    organizationId: organization.id,
    organizationSlug,
    organization,
  }
}

/**
 * Canonical slug for typed links inside organization features. Every dynamic
 * link keeps the param explicitly: `params={{ organizationSlug }}`.
 */
export function useOrganizationSlug(): string {
  const { organizationSlug } = useParams({ strict: false })
  if (!organizationSlug) throw new Error(t('common:errors.slugRequired'))
  return organizationSlug
}

/**
 * Target used when the requested slug needs a native `setActive` plus a full
 * document reload. Keeps the exact requested `/o/<slug>...` URL (search and
 * hash included) when the path already belongs to the resolved organization,
 * so a direct link never lands on a different page after activation.
 */
export function organizationBoundaryTarget(
  organizationSlug: string,
  location: { pathname: string; href: string }
) {
  const root = `/o/${organizationSlug}`
  if (location.pathname === root || location.pathname.startsWith(`${root}/`))
    return location.href
  return root
}
