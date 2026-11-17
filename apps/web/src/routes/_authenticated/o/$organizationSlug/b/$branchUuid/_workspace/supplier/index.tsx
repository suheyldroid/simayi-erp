import { createFileRoute } from '@tanstack/react-router'
import { Suppliers } from '@/features/supplier'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/_workspace/supplier/'
)({
  component: Suppliers,
})
