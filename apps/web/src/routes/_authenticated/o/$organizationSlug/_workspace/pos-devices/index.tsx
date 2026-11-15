import { createFileRoute } from '@tanstack/react-router'
import { PosDevicesPage } from '@/features/pos-devices'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/_workspace/pos-devices/'
)({
  component: PosDevicesPage,
})
