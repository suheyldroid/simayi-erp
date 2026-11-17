import axios from 'axios'
import { errorMessage } from '@/lib/api-error'
import { api, branchApi } from '@/lib/auth'
import { SalesPageModel, type SaleInput, type SaleReceiptInput } from './model'

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

/**
 * Shortage details of a rejected sale. `available` is the selected branch
 * balance, so the same message never mixes another branch's stock.
 */
export function saleShortages(error: unknown): SaleShortage[] {
  if (!axios.isAxiosError(error)) return []
  const details: unknown = error.response?.data?.error?.details
  if (details == null || typeof details !== 'object') return []
  if (!('shortages' in details)) return []
  const shortages = details.shortages
  if (!Array.isArray(shortages)) return []
  return shortages.filter(isShortage)
}

/** Page size shared by the branch and company sales lists. */
const PAGE_SIZE = 20

/**
 * Sales lists use the company client in Company context, so the backend
 * aggregates every branch of the verified organization without inventing a
 * default branch. A branch path filters exactly its own captured branch.
 */
export const salesApi = {
  async list(
    branchUuid: string | null,
    input: { page: number; search: string }
  ) {
    const params = {
      limit: PAGE_SIZE,
      offset: input.page * PAGE_SIZE,
      search: input.search || undefined,
    }
    return SalesPageModel.list.parse(
      (
        await (branchUuid === null
          ? api.get<unknown>('/sales/', { params })
          : branchApi.get<unknown>('/sales/', { branchUuid, params }))
      ).data
    )
  },
  async get(branchUuid: string | null, uuid: string) {
    return SalesPageModel.sale.parse(
      (
        await (branchUuid === null
          ? api.get<unknown>(`/sales/${uuid}`)
          : branchApi.get<unknown>(`/sales/${uuid}`, { branchUuid }))
      ).data
    )
  },
  async record(branchUuid: string, body: SaleInput) {
    return SalesPageModel.sale.parse(
      (await branchApi.post<unknown>('/sales/', body, { branchUuid })).data
    )
  },
  async receipt(branchUuid: string, uuid: string, body: SaleReceiptInput) {
    return SalesPageModel.sale.parse(
      (
        await branchApi.post<unknown>(`/sales/${uuid}/receipts/`, body, {
          branchUuid,
        })
      ).data
    )
  },
}

/**
 * Sales channels stay company-shared metadata, so they use the company client
 * and never send a branch header.
 */
export const salesChannelApi = {
  async list(input?: { search?: string }) {
    return SalesPageModel.channelList.parse(
      (
        await api.get<unknown>('/sales/channels/', {
          params: {
            limit: 100,
            offset: 0,
            search: input?.search?.trim() || undefined,
          },
        })
      ).data
    )
  },
  async create(name: string) {
    return SalesPageModel.channel.parse(
      (await api.post<unknown>('/sales/channels/', { name })).data
    )
  },
  async update(uuid: string, body: { name?: string; active?: boolean }) {
    return SalesPageModel.channel.parse(
      (await api.patch<unknown>(`/sales/channels/${uuid}`, body)).data
    )
  },
}
