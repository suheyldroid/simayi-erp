import { createFileRoute } from '@tanstack/react-router'
import { SaleDetail } from '@/features/sales/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/_workspace/sales/$saleId'
)({
  component: SaleDetail,
})
