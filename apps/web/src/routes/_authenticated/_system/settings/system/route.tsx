import { createFileRoute } from '@tanstack/react-router'
import { SystemSettingsGate } from '@/features/settings/system-gate'

export const Route = createFileRoute('/_authenticated/_system/settings/system')(
  {
    component: SystemSettingsGate,
  }
)
