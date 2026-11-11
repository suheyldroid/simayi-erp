import { createFileRoute } from '@tanstack/react-router'
import { StockShow } from '@/features/stock/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/_workspace/stock/$itemId'
)({
  component: StockShow,
})
