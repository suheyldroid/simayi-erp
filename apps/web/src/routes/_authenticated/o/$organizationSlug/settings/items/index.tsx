import { createFileRoute } from '@tanstack/react-router'
import { ItemsCatalog } from '@/features/items'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/settings/items/'
)({
  component: ItemsCatalog,
})
