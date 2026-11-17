import { createFileRoute } from '@tanstack/react-router'
import { CategoryDetail } from '@/features/item-categories/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/settings/item-categories/$categoryId'
)({
  remountDeps: ({ params }) =>
    `${params.organizationSlug}/${params.branchUuid}/${params.categoryId}`,
  component: CategoryDetail,
})
