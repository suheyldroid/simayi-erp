import { createFileRoute } from '@tanstack/react-router'
import { StockLocations } from '@/features/stock'

export const Route = createFileRoute('/_authenticated/stock/')({
  component: StockLocations,
})
