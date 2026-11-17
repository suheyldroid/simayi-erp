import { createFileRoute } from '@tanstack/react-router'
import { Recipes } from '@/features/recipes'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/settings/recipes/'
)({
  component: Recipes,
})
