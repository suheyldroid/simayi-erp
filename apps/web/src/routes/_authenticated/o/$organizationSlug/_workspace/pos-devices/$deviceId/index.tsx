import { createFileRoute } from '@tanstack/react-router'
import { PosDeviceDetail } from '@/features/pos-devices/show'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/_workspace/pos-devices/$deviceId/'
)({
  component: PosDeviceDetail,
})
