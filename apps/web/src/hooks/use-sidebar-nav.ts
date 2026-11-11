import { useRouter } from '@tanstack/react-router'
import {
  organizationNavEntries,
  type OrganizationNavEntry,
} from '@/components/layout/data/sidebar-data'
import type { NavGroup, NavItem } from '@/components/layout/types'

function navItems(
  entries: readonly OrganizationNavEntry[],
  resolve: (to: OrganizationNavEntry['to']) => string
): NavItem[] {
  return entries.map((entry) => ({
    title: entry.title,
    icon: entry.icon,
    overview: entry.overview,
    matchChildren: entry.matchChildren,
    url: resolve(entry.to),
  }))
}

/**
 * Business navigation for the organization workspace shell. It is only mounted
 * inside the verified slug boundary. Every link carries the verified slug
 * through the typed router builder.
 */
export function useOrganizationSidebarNav(
  organizationSlug: string
): NavGroup[] {
  const router = useRouter()
  const items = navItems(
    organizationNavEntries,
    (to) => router.buildLocation({ to, params: { organizationSlug } }).href
  )

  if (items.length === 0) return []
  return [
    {
      title: 'Organization',
      context: 'organization',
      hideLabel: true,
      items,
    },
  ]
}
