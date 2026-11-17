import { createFileRoute } from '@tanstack/react-router'
import { BranchDetail } from '@/features/branches/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/settings/branches/$branchId'
)({
  remountDeps: ({ params }) => `${params.organizationSlug}/${params.branchId}`,
  component: BranchDetail,
})
