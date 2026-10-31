import { createFileRoute } from '@tanstack/react-router'
import { Common } from '@/features/common'

export const Route = createFileRoute('/_authenticated/common/')({
  component: Common,
})
