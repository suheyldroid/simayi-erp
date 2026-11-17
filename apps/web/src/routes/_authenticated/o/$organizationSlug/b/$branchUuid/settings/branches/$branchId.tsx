import { createFileRoute } from '@tanstack/react-router'
import { BranchDetail } from '@/features/branches/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/settings/branches/$branchId'
)({
  remountDeps: ({ params }) =>
    `${params.organizationSlug}/${params.branchUuid}/${params.branchId}`,
  component: BranchDetail,
})
