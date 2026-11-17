import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid/settings/'
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/o/$organizationSlug/b/$branchUuid/settings/manage',
      params: {
        organizationSlug: params.organizationSlug,
        branchUuid: params.branchUuid,
      },
      replace: true,
    })
  },
})
