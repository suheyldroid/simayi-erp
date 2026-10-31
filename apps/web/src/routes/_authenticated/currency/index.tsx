import { createFileRoute } from '@tanstack/react-router'
import { Currency } from '@/features/currency'

export const Route = createFileRoute('/_authenticated/currency/')({
  component: Currency,
})
