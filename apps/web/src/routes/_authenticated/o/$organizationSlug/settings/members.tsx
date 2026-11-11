import { createFileRoute } from '@tanstack/react-router'
import { OrganizationMembers } from '@/features/organization/members'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/settings/members'
)({
  component: OrganizationMembers,
})
