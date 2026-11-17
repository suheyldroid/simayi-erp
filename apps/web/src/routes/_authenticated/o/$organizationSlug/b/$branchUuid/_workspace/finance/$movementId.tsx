import { createFileRoute } from '@tanstack/react-router'
import { MoneyMovementDetail } from '@/features/finance/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/_workspace/finance/$movementId'
)({
  component: MoneyMovementDetail,
})
