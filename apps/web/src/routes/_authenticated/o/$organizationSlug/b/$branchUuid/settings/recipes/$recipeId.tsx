import { createFileRoute } from '@tanstack/react-router'
import { RecipeDetail } from '@/features/recipes/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/settings/recipes/$recipeId'
)({
  remountDeps: ({ params }) =>
    `${params.organizationSlug}/${params.branchUuid}/${params.recipeId}`,
  component: RecipeDetail,
})
