import { createFileRoute } from '@tanstack/react-router'
import { OrganizationDetails } from '@/features/organization/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/settings/manage'
)({
  component: OrganizationDetails,
})
