import { type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams, useRouter } from '@tanstack/react-router'
import {
  Building2,
  Coins,
  Ruler,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { isAdministrator, sessionQuery } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { organizationSettingsNavEntries } from '@/components/layout/data/sidebar-data'
import { useOrganizationMemberships } from '@/features/organization/membership-query'

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
  { title: 'Profile', to: '/settings', icon: UserCog },
]

/**
 * Platform administration. They share the system requirements of native user
 * management: a verified account session with the platform `admin` role, and
 * no active organization.
 */
const systemSettingsEntries: readonly UserSettingsEntry[] = [
  { title: 'Users', to: '/settings/system/users', icon: Users },
  {
    title: 'Units',
    to: '/settings/system/units',
    icon: Ruler,
    matchChildren: true,
  },
  { title: 'Currency', to: '/settings/system/currency', icon: Coins },
]

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
 * native membership list; it never activates an organization or reads tenant
 * business data.
 */
export function SettingsNav() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const { organizationSlug } = useParams({ strict: false })
  const router = useRouter()
  const session = useQuery(sessionQuery)
  const organizations = useOrganizationMemberships()
  const platformAdmin = session.isSuccess && isAdministrator(session.data?.user)

  return (
    <nav aria-label='Settings' className='flex flex-col gap-6'>
      <SettingsNavSection title='User'>
        {userSettingsEntries.map((entry) => (
          <StaticSettingsLink
            key={entry.to}
            entry={entry}
            active={isActivePath(pathname, entry.to)}
          />
        ))}
      </SettingsNavSection>

      {platformAdmin ? (
        <SettingsNavSection title='System'>
          {systemSettingsEntries.map((entry) => (
            <StaticSettingsLink
              key={entry.to}
              entry={entry}
              active={isActivePath(pathname, entry.to, entry.matchChildren)}
            />
          ))}
        </SettingsNavSection>
      ) : null}

      <SettingsNavSection title='Organization'>
        {organizations.isPending ? (
          <li>
            <p role='status' className='px-2 text-sm text-muted-foreground'>
              Loading organizations…
            </p>
          </li>
        ) : null}
        {organizations.isError ? (
          <li className='space-y-2 px-2'>
            <p role='alert' className='text-sm text-muted-foreground'>
              Could not load organizations.
            </p>
            <Button
              variant='outline'
              size='sm'
              onClick={() => void organizations.refetch()}
            >
              Retry
            </Button>
          </li>
        ) : null}
        {organizations.isSuccess ? (
          organizations.data.length === 0 ? (
            <li>
              <p className='px-2 text-sm text-muted-foreground'>
                Organization bulunmuyor
              </p>
            </li>
          ) : (
            organizations.data.map((organization) => {
              const active = organization.slug === organizationSlug
              return (
                <li key={organization.id} className='space-y-1'>
                  <Link
                    to='/o/$organizationSlug/settings'
                    params={{ organizationSlug: organization.slug }}
                    aria-current={active ? 'page' : undefined}
                    className={navLinkClassName(active)}
                  >
                    <Building2
                      aria-hidden='true'
                      className='size-[18px] shrink-0'
                    />
                    <span className='truncate'>
                      {organization.name || organization.slug}
                    </span>
                  </Link>
                  {active ? (
                    <ul className='space-y-1 border-s border-border ps-3'>
                      {organizationSettingsNavEntries.map((entry) => {
                        const href = router.buildLocation({
                          to: entry.to,
                          params: { organizationSlug: organization.slug },
                        }).href
                        const entryActive = isActivePath(
                          pathname,
                          href,
                          entry.matchChildren
                        )
                        const Icon = entry.icon
                        return (
                          <li key={entry.to}>
                            <Link
                              to={entry.to}
                              params={{ organizationSlug: organization.slug }}
                              aria-current={entryActive ? 'page' : undefined}
                              className={cn(
                                buttonVariants({
                                  variant: 'ghost',
                                  size: 'sm',
                                }),
                                'w-full justify-start',
                                entryActive
                                  ? 'bg-muted hover:bg-accent'
                                  : 'hover:bg-accent hover:underline'
                              )}
                            >
                              <Icon
                                aria-hidden='true'
                                className='size-4 shrink-0'
                              />
                              {entry.title}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </li>
              )
            })
          )
        ) : null}
      </SettingsNavSection>
    </nav>
  )
}
