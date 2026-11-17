import { createFileRoute } from '@tanstack/react-router'
import { SupplierDetail } from '@/features/supplier/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/_workspace/supplier/$supplierId'
)({
  component: SupplierDetail,
})
