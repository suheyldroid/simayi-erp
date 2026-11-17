import { createFileRoute } from '@tanstack/react-router'
import { OrganizationDashboard } from '@/features/organization-dashboard'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/_workspace/'
)({
  component: OrganizationDashboard,
})
