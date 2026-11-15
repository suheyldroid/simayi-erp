import type { ElementType } from 'react'
import {
  BookOpen,
  Boxes,
  Building,
  Building2,
  CreditCard,
  LayoutDashboard,
  LayoutGrid,
  ListTree,
  Package,
  Receipt,
  ShoppingCart,
  Wallet,
  Users,
  UsersRound,
} from 'lucide-react'
import { type SidebarData } from '../types'

/**
 * System layer navigation. Global pages only: no organization switcher, no
 * organization groups and no tenant-scoped entries. Account settings are
 * reached from the header account menu, so they are not repeated here.
 */
export const systemSidebarData: SidebarData = {
  navGroups: [
    {
      title: 'Global',
      context: 'global',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Organizations',
          url: '/organization',
          icon: Building2,
        },
      ],
    },
  ],
}

export type OrganizationNavEntry = {
  title: string
  /**
   * Typed route path; the shell resolves its concrete URL with the verified
   * `organizationSlug` param, never by string concatenation.
   */
  to:
    | '/o/$organizationSlug'
    | '/o/$organizationSlug/supplier'
    | '/o/$organizationSlug/stock'
    | '/o/$organizationSlug/purchasing'
    | '/o/$organizationSlug/sales'
    | '/o/$organizationSlug/pos-devices'
    | '/o/$organizationSlug/finance'
    | '/o/$organizationSlug/settings'
  icon: ElementType
  /** Overview already is this workspace; it is not repeated as a section card. */
  overview?: boolean
  /** List entries stay active on their detail routes. */
  matchChildren?: boolean
}

/**
 * Business navigation. Rendered only by the organization detail layout, after
 * the slug/session boundary matched.
 */
export const organizationNavEntries: readonly OrganizationNavEntry[] = [
  {
    title: 'Overview',
    to: '/o/$organizationSlug',
    icon: LayoutGrid,
    overview: true,
  },
  {
    title: 'Suppliers',
    to: '/o/$organizationSlug/supplier',
    icon: Building,
  },
  {
    title: 'Stock',
    to: '/o/$organizationSlug/stock',
    icon: Package,
    matchChildren: true,
  },
  {
    title: 'Purchasing',
    to: '/o/$organizationSlug/purchasing',
    icon: ShoppingCart,
  },
  {
    title: 'Sales',
    to: '/o/$organizationSlug/sales',
    icon: Receipt,
  },
  {
    title: 'POS devices',
    to: '/o/$organizationSlug/pos-devices',
    icon: CreditCard,
    matchChildren: true,
  },
  {
    title: 'Finance',
    to: '/o/$organizationSlug/finance',
    icon: Wallet,
    matchChildren: true,
  },
]

export type OrganizationSettingsNavEntry = {
  title: string
  /**
   * Typed route path inside the settings shell; the shell resolves its
   * concrete URL with the verified `organizationSlug` param.
   */
  to:
    | '/o/$organizationSlug/settings/items'
    | '/o/$organizationSlug/settings/item-categories'
    | '/o/$organizationSlug/settings/recipes'
    | '/o/$organizationSlug/settings/manage'
    | '/o/$organizationSlug/settings/members'
    | '/o/$organizationSlug/settings/teams'
  icon: ElementType
  /** List entries stay active on their detail routes. */
  matchChildren?: boolean
}

/**
 * Organization settings navigation. Rendered inside the shared settings frame
 * under the verified slug boundary, both for the active organization and in
 * the organization category of global settings. Every entry is available to
 * any verified membership; the Details, Members and Teams pages keep their own
 * native owner/admin rules.
 */
export const organizationSettingsNavEntries: readonly OrganizationSettingsNavEntry[] =
  [
    {
      title: 'Items',
      to: '/o/$organizationSlug/settings/items',
      icon: Boxes,
      matchChildren: true,
    },
    {
      title: 'Item categories',
      to: '/o/$organizationSlug/settings/item-categories',
      icon: ListTree,
      matchChildren: true,
    },
    {
      title: 'Recipes',
      to: '/o/$organizationSlug/settings/recipes',
      icon: BookOpen,
      matchChildren: true,
    },
    {
      title: 'Details',
      to: '/o/$organizationSlug/settings/manage',
      icon: Building2,
    },
    {
      title: 'Members',
      to: '/o/$organizationSlug/settings/members',
      icon: Users,
    },
    {
      title: 'Teams',
      to: '/o/$organizationSlug/settings/teams',
      icon: UsersRound,
    },
  ]
