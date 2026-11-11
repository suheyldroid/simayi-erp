import { errorMessage } from '@/lib/api-error'
import { api } from '@/lib/auth'
import { ItemsModel } from '@/features/items/model'
import { StockPageModel, type StockOperation } from './model'

export { errorMessage }

const STOCK_PAGE_SIZE = 20

export const stockApi = {
  async adjust(
    itemUuid: string,
    operation: StockOperation,
    body: { version: number; quantity: string; notes?: string }
  ) {
    return ItemsModel.item.parse(
      (await api.post<unknown>(`/items/${itemUuid}/stock/${operation}`, body))
        .data
    )
  },
  async tracking(itemUuid: string, page = 0) {
    return StockPageModel.tracking.parse(
      (
        await api.get<unknown>(`/items/${itemUuid}/tracking/`, {
          params: {
            limit: STOCK_PAGE_SIZE,
            offset: page * STOCK_PAGE_SIZE,
          },
        })
      ).data
    )
  },
}
