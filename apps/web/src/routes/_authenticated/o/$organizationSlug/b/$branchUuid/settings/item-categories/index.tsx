import { createFileRoute } from '@tanstack/react-router'
import { ItemCategories } from '@/features/item-categories'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/settings/item-categories/'
)({
  component: ItemCategories,
})
