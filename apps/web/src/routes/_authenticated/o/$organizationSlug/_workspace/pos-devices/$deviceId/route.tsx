import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/_workspace/pos-devices/$deviceId'
)({
  component: Outlet,
})
