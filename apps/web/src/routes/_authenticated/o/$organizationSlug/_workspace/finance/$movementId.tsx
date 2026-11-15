import { createFileRoute } from '@tanstack/react-router'
import { MoneyMovementDetail } from '@/features/finance/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/_workspace/finance/$movementId'
)({
  component: MoneyMovementDetail,
})
