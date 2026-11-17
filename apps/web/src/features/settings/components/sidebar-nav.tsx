import { type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useMatch, useRouter } from '@tanstack/react-router'
import {
  Building2,
  Coins,
  Ruler,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { isAdministrator, sessionQuery } from '@/lib/auth'
import { useOptionalBranch } from '@/lib/branch-boundary'
import { t } from '@/lib/i18n'
import {
  organizationLocation,
  type OrganizationTarget,
} from '@/lib/organization-navigation'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { organizationSettingsNavEntries } from '@/components/layout/data/sidebar-data'
import { BranchSwitcher } from '@/features/branches/branch-switcher'

type StaticSettingsPath =
  | '/settings'
  | '/settings/system/users'
  | '/settings/system/units'
  | '/settings/system/currency'

type UserSettingsEntry = {
  title: string
  to: StaticSettingsPath
  icon: LucideIcon
  /** List entries stay active on their detail routes. */
  matchChildren?: boolean
}

/**
 * Personal settings. These pages only need the account session and stay
 * available without an active organization.
 */
const userSettingsEntries: readonly UserSettingsEntry[] = [
  {
    title: t('global:settings.nav.profile'),
    to: '/settings',
    icon: UserCog,
  },
]

/**
 * Platform administration. They share the system requirements of native user
 * management: a verified account session with the platform `admin` role, and
 * no active organization.
 */
const systemSettingsEntries: readonly UserSettingsEntry[] = [
  {
    title: t('global:settings.nav.users'),
    to: '/settings/system/users',
    icon: Users,
  },
  {
    title: t('global:settings.nav.units'),
    to: '/settings/system/units',
    icon: Ruler,
    matchChildren: true,
  },
  {
    title: t('global:settings.nav.currency'),
    to: '/settings/system/currency',
    icon: Coins,
  },
]

const ORGANIZATION_ROUTE_ID = '/_authenticated/o/$organizationSlug' as const

function isActivePath(pathname: string, href: string, matchChildren = false) {
  const current = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const rawTarget = href.split('?')[0] ?? href
  const target =
    rawTarget.length > 1 ? rawTarget.replace(/\/+$/, '') : rawTarget
  return (
    current === target || (matchChildren && current.startsWith(`${target}/`))
  )
}

function navLinkClassName(active: boolean) {
  return cn(
    buttonVariants({ variant: 'ghost' }),
    'w-full justify-start',
    active ? 'bg-muted hover:bg-accent' : 'hover:bg-accent hover:underline'
  )
}

function SettingsNavSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className='space-y-1'>
      <h2 className='px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase'>
        {title}
      </h2>
      <ul className='space-y-1'>{children}</ul>
    </section>
  )
}

function StaticSettingsLink({
  entry,
  active,
}: {
  entry: UserSettingsEntry
  active: boolean
}) {
  const Icon = entry.icon
  return (
    <li>
      <Link
        to={entry.to}
        aria-current={active ? 'page' : undefined}
        className={navLinkClassName(active)}
      >
        <Icon aria-hidden='true' className='size-[18px]' />
        {entry.title}
      </Link>
    </li>
  )
}

/**
 * Categorized settings navigation shared by personal, platform and
 * organization settings. It reads only the global account session and the
 * verified path scope; it never activates an organization, never lists the
 * account's memberships for navigation and never reads tenant business data.
 *
 * Organization scope comes from the path:
 * - company scope (`/o/<slug>/settings`) shows the current company label, the
 *   branch selector and that company's settings entries;
 * - branch scope (`/o/<slug>/b/<uuid>/settings`) shows the verified company
 *   label, the branch selector and the same settings entries.
 *
 * There is no cross-organization chooser in either scope, and personal/system
 * settings (`/settings*`) render no organization section at all.
 */
export function SettingsNav() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const organizationMatch = useMatch({
    from: ORGANIZATION_ROUTE_ID,
    shouldThrow: false,
  })
  const branch = useOptionalBranch()
  const router = useRouter()
  const session = useQuery(sessionQuery)
  const platformAdmin = session.isSuccess && isAdministrator(session.data?.user)

  const organization = organizationMatch?.context.organization ?? null
  const organizationSlug = organizationMatch?.context.organizationSlug ?? null
  const branchUuid = branch?.branchUuid ?? null

  function settingsHref(
    slug: string,
    scopedBranchUuid: string | null,
    target: OrganizationTarget
  ) {
    return router.buildLocation(
      organizationLocation(slug, scopedBranchUuid, target)
    ).href
  }

  function settingsEntries(slug: string, scopedBranchUuid: string | null) {
    return organizationSettingsNavEntries.map((entry) => {
      const href = settingsHref(slug, scopedBranchUuid, entry.target)
      return {
        entry,
        href,
        active: isActivePath(pathname, href, entry.matchChildren),
      }
    })
  }

  return (
    <nav
      aria-label={t('global:settings.nav.ariaLabel')}
      className='flex flex-col gap-6'
    >
      <SettingsNavSection title={t('global:settings.nav.userSection')}>
        {userSettingsEntries.map((entry) => (
          <StaticSettingsLink
            key={entry.to}
            entry={entry}
            active={isActivePath(pathname, entry.to)}
          />
        ))}
      </SettingsNavSection>

      {platformAdmin ? (
        <SettingsNavSection title={t('global:settings.nav.systemSection')}>
          {systemSettingsEntries.map((entry) => (
            <StaticSettingsLink
              key={entry.to}
              entry={entry}
              active={isActivePath(pathname, entry.to, entry.matchChildren)}
            />
          ))}
        </SettingsNavSection>
      ) : null}

      {organization && organizationSlug ? (
        <SettingsNavSection
          title={
            branch
              ? t('catalog:branches.settingsSection')
              : t('global:settings.nav.organizationSection')
          }
        >
          <li className='flex items-center gap-2 px-2 text-sm font-medium'>
            <Building2 aria-hidden='true' className='size-[18px] shrink-0' />
            <span className='truncate'>
              {organization.name || organizationSlug}
            </span>
          </li>
          <li>
            <BranchSwitcher />
          </li>
          <li>
            <ul className='space-y-1 border-s border-border ps-3'>
              {settingsEntries(organizationSlug, branchUuid).map(
                ({ entry, href, active }) => {
                  const Icon = entry.icon
                  return (
                    <li key={entry.target}>
                      <Link
                        to={href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          buttonVariants({ variant: 'ghost', size: 'sm' }),
                          'w-full justify-start',
                          active
                            ? 'bg-muted hover:bg-accent'
                            : 'hover:bg-accent hover:underline'
                        )}
                      >
                        <Icon aria-hidden='true' className='size-4 shrink-0' />
                        {entry.title}
                      </Link>
                    </li>
                  )
                }
              )}
            </ul>
          </li>
        </SettingsNavSection>
      ) : null}
    </nav>
  )
}
