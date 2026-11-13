import { createFileRoute } from '@tanstack/react-router'
import { CurrencySettings } from '@/features/currency'

export const Route = createFileRoute(
  '/_authenticated/_system/settings/system/currency'
)({
  component: CurrencySettings,
})
