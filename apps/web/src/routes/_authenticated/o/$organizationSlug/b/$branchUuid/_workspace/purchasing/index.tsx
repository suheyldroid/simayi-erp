import { createFileRoute } from '@tanstack/react-router'
import { PurchasingPage } from '@/features/purchasing'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/_workspace/purchasing/'
)({
  component: PurchasingPage,
})
