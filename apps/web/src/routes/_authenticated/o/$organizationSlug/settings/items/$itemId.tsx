import { createFileRoute } from '@tanstack/react-router'
import { ItemDetail } from '@/features/items/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/settings/items/$itemId'
)({
  remountDeps: ({ params }) => `${params.organizationSlug}/${params.itemId}`,
  component: ItemDetail,
})
