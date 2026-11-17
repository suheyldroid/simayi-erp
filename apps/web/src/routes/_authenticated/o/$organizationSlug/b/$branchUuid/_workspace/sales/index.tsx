import { createFileRoute } from '@tanstack/react-router'
import { SalesPage } from '@/features/sales'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/_workspace/sales/'
)({
  component: SalesPage,
})
