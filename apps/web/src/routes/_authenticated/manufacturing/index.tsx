import { createFileRoute } from '@tanstack/react-router'
import { ManufacturingPage } from '@/features/manufacturing'

export const Route = createFileRoute('/_authenticated/manufacturing/')({
  component: ManufacturingPage,
})
