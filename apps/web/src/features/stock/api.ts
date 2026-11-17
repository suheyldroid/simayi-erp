import { errorMessage } from '@/lib/api-error'
import { api, branchApi } from '@/lib/auth'
import { StockPageModel, type StockOperation } from './model'

export { errorMessage }

const STOCK_PAGE_SIZE = 20

export const stockApi = {
  /**
   * Item x branch stock positions. A verified branch UUID narrows the list to
   * that branch; `null` reads the whole organization through the company
   * client, so no branch header is ever sent and no balance row is created.
   */
  async balances(input: {
    branchUuid?: string | null
    page?: number
    search?: string
    categoryUuid?: string
    low?: boolean
    limit?: number
  }) {
    const page = input.page ?? 0
    const limit = input.limit ?? STOCK_PAGE_SIZE
    const params = {
      limit,
      offset: page * limit,
      search: input.search || undefined,
      categoryUuid: input.categoryUuid,
      low: input.low ? true : undefined,
    }
    const response =
      input.branchUuid == null
        ? await api.get<unknown>('/stock/', { params })
        : await branchApi.get<unknown>('/stock/', {
            branchUuid: input.branchUuid,
            params,
          })
    return StockPageModel.balances.parse(response.data)
  },
  async balance(itemUuid: string, branchUuid: string) {
    return StockPageModel.balance.parse(
      (
        await branchApi.get<unknown>(`/stock/${itemUuid}`, {
          branchUuid,
        })
      ).data
    )
  },
  async adjust(
    itemUuid: string,
    branchUuid: string,
    operation: StockOperation,
    body: { version: number; quantity: string; notes?: string }
  ) {
    return StockPageModel.balance.parse(
      (
        await branchApi.post<unknown>(`/stock/${itemUuid}/${operation}`, body, {
          branchUuid,
        })
      ).data
    )
  },
  async updateMinimum(
    itemUuid: string,
    branchUuid: string,
    body: { version: number; minimumStock: string }
  ) {
    return StockPageModel.balance.parse(
      (
        await branchApi.patch<unknown>(`/stock/${itemUuid}`, body, {
          branchUuid,
        })
      ).data
    )
  },
  async tracking(itemUuid: string, branchUuid: string, page = 0) {
    return StockPageModel.tracking.parse(
      (
        await branchApi.get<unknown>(`/items/${itemUuid}/tracking/`, {
          branchUuid,
          params: {
            limit: STOCK_PAGE_SIZE,
            offset: page * STOCK_PAGE_SIZE,
          },
        })
      ).data
    )
  },
}
