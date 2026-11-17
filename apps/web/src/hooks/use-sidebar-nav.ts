import { useRouter } from '@tanstack/react-router'
import { t } from '@/lib/i18n'
import {
  organizationLocation,
  type OrganizationTarget,
} from '@/lib/organization-navigation'
import {
  organizationNavEntries,
  type OrganizationNavEntry,
} from '@/components/layout/data/sidebar-data'
import type { NavGroup, NavItem } from '@/components/layout/types'

function navItems(
  entries: readonly OrganizationNavEntry[],
  resolve: (target: OrganizationTarget) => string
): NavItem[] {
  return entries.map((entry) => ({
    title: entry.title,
    icon: entry.icon,
    overview: entry.overview,
    matchChildren: entry.matchChildren,
    url: resolve(entry.target),
  }))
}

/**
 * Business navigation for the organization workspace shell, mounted by the
 * company and the branch shells alike. Every link is resolved from the same
 * closed target set through `organizationLocation`, so the verified scope
 * decides the URL: company sections stay under `/o/<slug>`, branch sections
 * under `/o/<slug>/b/<uuid>`. Nothing here reads or writes a branch query.
 */
export function useOrganizationSidebarNav(
  organizationSlug: string,
  branchUuid: string | null
): NavGroup[] {
  const router = useRouter()
  const items = navItems(
    organizationNavEntries,
    (target) =>
      router.buildLocation(
        organizationLocation(organizationSlug, branchUuid, target)
      ).href
  )

  if (items.length === 0) return []
  return [
    {
      title: t('common:navigation.organization'),
      context: 'organization',
      hideLabel: true,
      items,
    },
  ]
}
