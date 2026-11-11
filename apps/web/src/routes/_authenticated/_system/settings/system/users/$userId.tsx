import { createFileRoute } from '@tanstack/react-router'
import { UserDetail } from '@/features/users/show'

export const Route = createFileRoute(
  '/_authenticated/_system/settings/system/users/$userId'
)({
  component: UserDetail,
})
