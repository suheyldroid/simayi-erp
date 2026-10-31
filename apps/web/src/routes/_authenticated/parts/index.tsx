import { createFileRoute } from '@tanstack/react-router'
import { PartsCatalog } from '@/features/part'

export const Route = createFileRoute('/_authenticated/parts/')({
  component: PartsCatalog,
})
