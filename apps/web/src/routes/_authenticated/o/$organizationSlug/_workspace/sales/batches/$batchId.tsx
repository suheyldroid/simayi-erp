import { createFileRoute } from '@tanstack/react-router'
import { SalesBatchDetail } from '@/features/sales/batches/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/_workspace/sales/batches/$batchId'
)({
  component: SalesBatchDetail,
})
