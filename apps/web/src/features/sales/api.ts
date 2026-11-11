import axios from 'axios'
import { errorMessage } from '@/lib/api-error'
import { api } from '@/lib/auth'
import { SalesPageModel, type SaleInput } from './model'

export { errorMessage }

export type SaleShortage = {
  componentName: string
  componentUnits: string
  required: string
  available: string
  missing: string
}

function isShortage(value: unknown): value is SaleShortage {
  if (value == null || typeof value !== 'object') return false
  return (
    'componentName' in value &&
    typeof value.componentName === 'string' &&
    'componentUnits' in value &&
    typeof value.componentUnits === 'string' &&
    'required' in value &&
    typeof value.required === 'string' &&
    'available' in value &&
    typeof value.available === 'string' &&
    'missing' in value &&
    typeof value.missing === 'string'
  )
}

export function saleShortages(error: unknown): SaleShortage[] {
  if (!axios.isAxiosError(error)) return []
  const details: unknown = error.response?.data?.error?.details
  if (details == null || typeof details !== 'object') return []
  if (!('shortages' in details)) return []
  const shortages = details.shortages
  if (!Array.isArray(shortages)) return []
  return shortages.filter(isShortage)
}

export const salesApi = {
  async list(input: { page: number; search: string }) {
    return SalesPageModel.list.parse(
      (
        await api.get<unknown>('/sales/', {
          params: {
            limit: 20,
            offset: input.page * 20,
            search: input.search || undefined,
          },
        })
      ).data
    )
  },
  async get(uuid: string) {
    return SalesPageModel.sale.parse(
      (await api.get<unknown>(`/sales/${uuid}`)).data
    )
  },
  async record(body: SaleInput) {
    return SalesPageModel.sale.parse(
      (await api.post<unknown>('/sales/', body)).data
    )
  },
}
