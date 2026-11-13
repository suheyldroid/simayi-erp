import { createFileRoute } from '@tanstack/react-router'
import { SalesBatchesPage } from '@/features/sales/batches'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/_workspace/sales/batches/'
)({
  component: SalesBatchesPage,
})
