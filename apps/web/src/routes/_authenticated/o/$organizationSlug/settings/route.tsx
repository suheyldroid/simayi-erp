import { createFileRoute } from '@tanstack/react-router'
import { OrganizationSettingsLayout } from '@/components/layout/organization-settings-layout'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/settings'
)({
  component: OrganizationSettingsLayout,
})
