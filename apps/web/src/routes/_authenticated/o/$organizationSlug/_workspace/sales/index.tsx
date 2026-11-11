import { createFileRoute } from '@tanstack/react-router'
import { SalesPage } from '@/features/sales'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/_workspace/sales/'
)({
  component: SalesPage,
})
