import { createFileRoute } from '@tanstack/react-router'
import { SystemLayout } from '@/components/layout/system-layout'

export const Route = createFileRoute('/_authenticated/_system')({
  component: SystemLayout,
})
