import { Outlet } from '@tanstack/react-router'
import { useOrganizationBoundary } from '@/lib/organization-boundary'
import { Settings } from '@/features/settings'
import { SystemLayout } from './system-layout'
import { useShellReset } from './use-shell-reset'

/**
 * Organization settings adapter. The verified slug layout above still owns the
 * native membership and session checks; this layer only mounts the exact same
 * global shell and shared settings frame used by personal and system settings.
 * No second sidebar or provider is created.
 */
export function OrganizationSettingsLayout() {
  const { organizationId, organizationSlug } = useOrganizationBoundary()
  // Ephemeral UI state must not leak into the sibling workspace shell.
  useShellReset(`${organizationSlug}/settings`)
  return (
    <SystemLayout>
      <Settings>
        <Outlet key={organizationId} />
      </Settings>
    </SystemLayout>
  )
}
