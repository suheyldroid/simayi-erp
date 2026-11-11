import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/settings/'
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/o/$organizationSlug/settings/manage',
      params: { organizationSlug: params.organizationSlug },
      replace: true,
    })
  },
})
