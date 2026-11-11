import { createFileRoute } from '@tanstack/react-router'
import { OrganizationWorkspaceLayout } from '@/components/layout/organization-workspace-layout'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/_workspace'
)({
  component: OrganizationWorkspaceLayout,
})
