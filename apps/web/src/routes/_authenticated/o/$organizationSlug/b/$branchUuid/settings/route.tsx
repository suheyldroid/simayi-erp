import { createFileRoute } from '@tanstack/react-router'
import { OrganizationSettingsLayout } from '@/components/layout/organization-settings-layout'

/**
 * Branch settings shell. It reuses the shared settings frame: no company
 * membership chooser is rendered in branch scope.
 */
export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/settings'
)({
  component: OrganizationSettingsLayout,
})
