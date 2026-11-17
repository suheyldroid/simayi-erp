import { createFileRoute } from '@tanstack/react-router'
import { OrganizationDetails } from '@/features/organization/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/settings/manage'
)({
  component: OrganizationDetails,
})
