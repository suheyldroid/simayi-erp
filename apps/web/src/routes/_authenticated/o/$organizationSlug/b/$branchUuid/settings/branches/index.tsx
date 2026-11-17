import { createFileRoute } from '@tanstack/react-router'
import { Branches } from '@/features/branches'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/settings/branches/'
)({
  component: Branches,
})
