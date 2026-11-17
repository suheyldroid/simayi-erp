import { Outlet, useLocation } from '@tanstack/react-router'
import { branchOutletKey, useOptionalBranch } from '@/lib/branch-boundary'
import { useOrganizationBoundary } from '@/lib/organization-boundary'
import { Settings } from '@/features/settings'
import { SystemLayout } from './system-layout'
import { useShellReset } from './use-shell-reset'

/** Settings pages whose data, activation and customization are per branch. */
const branchSettingsPrefixes = ['settings/recipes'] as const

/**
 * Organization settings adapter, shared by the company route
 * (`/o/<slug>/settings`) and the branch mirror
 * (`/o/<slug>/b/<uuid>/settings`). The verified slug layout above still owns
 * the native membership and session checks; the branch route verified the
 * branch. This layer only mounts the exact same global shell and shared
 * settings frame used by personal and system settings. No second sidebar or
 * provider is created.
 *
 * Company catalog pages stay usable without a branch. Branch-aware settings
 * pages (recipes) are keyed by branch so they remount when the branch scope
 * changes. The key is a remount hint inside the current route match only:
 * company and branch settings paths are different route matches, so local
 * state (including unsaved editor state) is not guaranteed to survive a scope
 * switch; screens that need that own a navigation guard.
 */
export function OrganizationSettingsLayout() {
  const { organizationId, organizationSlug } = useOrganizationBoundary()
  const branchUuid = useOptionalBranch()?.branchUuid ?? null
  const pathname = useLocation({ select: (location) => location.pathname })
  const outletKey = branchOutletKey({
    organizationId,
    organizationSlug,
    pathname,
    branchUuid,
    prefixes: branchSettingsPrefixes,
  })
  // Ephemeral UI state must not leak into the sibling workspace shell.
  useShellReset(`${organizationSlug}/settings:${branchUuid ?? 'company'}`)
  return (
    <SystemLayout>
      <Settings>
        <Outlet key={outletKey} />
      </Settings>
    </SystemLayout>
  )
}
