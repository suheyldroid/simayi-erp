import { createFileRoute } from '@tanstack/react-router'
import { RecipeDetail } from '@/features/recipes/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/settings/recipes/$recipeId'
)({
  component: RecipeDetail,
})
