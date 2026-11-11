import { createFileRoute } from '@tanstack/react-router'
import { SupplierDetail } from '@/features/supplier/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/_workspace/supplier/$supplierId'
)({
  component: SupplierDetail,
})
