import { createFileRoute } from '@tanstack/react-router'
import { OrganizationMembers } from '@/features/organization/members'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/settings/members'
)({
  component: OrganizationMembers,
})
