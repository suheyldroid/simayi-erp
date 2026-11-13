import { createFileRoute } from '@tanstack/react-router'
import { UnitDetail } from '@/features/units/show'

export const Route = createFileRoute(
  '/_authenticated/_system/settings/system/units/$unitId'
)({
  remountDeps: ({ params }) => params.unitId,
  component: UnitDetail,
})
