import { createFileRoute } from '@tanstack/react-router'
import { PurchaseOrderDetail } from '@/features/purchasing/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/_workspace/purchasing/$orderId'
)({
  component: PurchaseOrderDetail,
})
