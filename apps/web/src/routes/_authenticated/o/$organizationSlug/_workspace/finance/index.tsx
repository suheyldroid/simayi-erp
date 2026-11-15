import { createFileRoute } from '@tanstack/react-router'
import { FinancePage } from '@/features/finance'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/_workspace/finance/'
)({
  component: FinancePage,
})
