import { createFileRoute } from '@tanstack/react-router'
import { OrganizationTeams } from '@/features/organization/teams'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/settings/teams'
)({
  component: OrganizationTeams,
})
