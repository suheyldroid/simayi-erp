import { createFileRoute } from '@tanstack/react-router'
import { Organizations } from '@/features/organization'

export const Route = createFileRoute('/_authenticated/_system/organization/')({
  component: Organizations,
})
