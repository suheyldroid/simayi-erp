import { type LinkProps } from '@tanstack/react-router'

type NavContext = 'global' | 'organization'

type BaseNavItem = {
  title: string
  badge?: string
  icon?: React.ElementType
  /** Marks the workspace overview link so pages do not repeat it as a section. */
  overview?: boolean
  /**
   * Keeps a list entry active on its detail routes (`<url>/<id>`). Only entries
   * that opt in match descendants; other links stay exact.
   */
  matchChildren?: boolean
}

type NavLink = BaseNavItem & {
  url: LinkProps['to'] | (string & {})
  items?: never
}

type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & { url: LinkProps['to'] | (string & {}) })[]
  url?: never
}

type NavItem = NavCollapsible | NavLink

type NavGroup = {
  title: string
  context: NavContext
  /**
   * Drops the visible group heading in a sidebar. The title still labels the
   * command menu group, so only the rendered sidebar heading disappears.
   */
  hideLabel?: boolean
  items: NavItem[]
}

type SidebarData = {
  navGroups: NavGroup[]
}

export type {
  SidebarData,
  NavGroup,
  NavItem,
  NavCollapsible,
  NavLink,
  NavContext,
}
