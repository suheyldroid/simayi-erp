import { createFileRoute } from '@tanstack/react-router'
import { Companies } from '@/features/company'

export const Route = createFileRoute('/_authenticated/company/')({
  component: Companies,
})
