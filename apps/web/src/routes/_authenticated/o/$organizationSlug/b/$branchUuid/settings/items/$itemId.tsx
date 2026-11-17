import { createFileRoute } from '@tanstack/react-router'
import { ItemDetail } from '@/features/items/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/settings/items/$itemId'
)({
  remountDeps: ({ params }) =>
    `${params.organizationSlug}/${params.branchUuid}/${params.itemId}`,
  component: ItemDetail,
})
