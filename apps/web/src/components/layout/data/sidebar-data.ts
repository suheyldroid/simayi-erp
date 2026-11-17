import type { ElementType } from 'react'
import {
  BookOpen,
  Boxes,
  Building,
  Building2,
  CreditCard,
  GitBranch,
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
import { t } from '@/lib/i18n'
import type { OrganizationTarget } from '@/lib/organization-navigation'
import { type SidebarData } from '../types'

/**
 * System layer navigation. Global pages only: no organization switcher, no
 * organization groups and no tenant-scoped entries. Account settings are
 * reached from the header account menu, so they are not repeated here.
 */
export const systemSidebarData: SidebarData = {
  navGroups: [
    {
      title: t('common:navigation.global'),
      context: 'global',
      items: [
        {
          title: t('common:navigation.dashboard'),
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: t('common:navigation.organizations'),
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
   * Organization-relative target. The shell resolves it for the verified scope
   * (company or branch path) through `organizationLocation`, never by string
   * concatenation.
   */
  target: Extract<
    OrganizationTarget,
    | ''
    | '/supplier'
    | '/stock'
    | '/purchasing'
    | '/sales'
    | '/pos-devices'
    | '/finance'
  >
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
    title: t('common:navigation.overview'),
    target: '',
    icon: LayoutGrid,
    overview: true,
  },
  {
    title: t('common:navigation.suppliers'),
    target: '/supplier',
    icon: Building,
  },
  {
    title: t('common:navigation.stock'),
    target: '/stock',
    icon: Package,
    matchChildren: true,
  },
  {
    title: t('common:navigation.purchasing'),
    target: '/purchasing',
    icon: ShoppingCart,
  },
  {
    title: t('common:navigation.sales'),
    target: '/sales',
    icon: Receipt,
  },
  {
    title: t('common:navigation.posDevices'),
    target: '/pos-devices',
    icon: CreditCard,
    matchChildren: true,
  },
  {
    title: t('common:navigation.finance'),
    target: '/finance',
    icon: Wallet,
    matchChildren: true,
  },
]

export type OrganizationSettingsNavEntry = {
  title: string
  /**
   * Organization-relative settings target; the shell resolves it for the
   * verified scope (company or branch settings path).
   */
  target: Extract<OrganizationTarget, `/settings${string}`>
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
      title: t('common:navigation.items'),
      target: '/settings/items',
      icon: Boxes,
      matchChildren: true,
    },
    {
      title: t('common:navigation.itemCategories'),
      target: '/settings/item-categories',
      icon: ListTree,
      matchChildren: true,
    },
    {
      title: t('common:navigation.recipes'),
      target: '/settings/recipes',
      icon: BookOpen,
      matchChildren: true,
    },
    {
      title: t('common:navigation.branches'),
      target: '/settings/branches',
      icon: GitBranch,
      matchChildren: true,
    },
    {
      title: t('common:navigation.details'),
      target: '/settings/manage',
      icon: Building2,
    },
    {
      title: t('common:navigation.members'),
      target: '/settings/members',
      icon: Users,
    },
    {
      title: t('common:navigation.teams'),
      target: '/settings/teams',
      icon: UsersRound,
    },
  ]
