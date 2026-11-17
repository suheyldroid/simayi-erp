import { createFileRoute } from '@tanstack/react-router'
import { ZReportsPage } from '@/features/pos-devices/z-reports'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/_workspace/pos-devices/$deviceId/z-reports/'
)({
  component: ZReportsPage,
})
