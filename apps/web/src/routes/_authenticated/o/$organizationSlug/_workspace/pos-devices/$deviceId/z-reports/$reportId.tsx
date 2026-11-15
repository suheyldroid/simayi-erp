import { createFileRoute } from '@tanstack/react-router'
import { ZReportDetail } from '@/features/pos-devices/z-reports/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/_workspace/pos-devices/$deviceId/z-reports/$reportId'
)({
  component: ZReportDetail,
})
