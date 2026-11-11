import { errorMessage } from '@/lib/api-error'
import { api } from '@/lib/auth'
import {
  PurchasingModel,
  type ExtraInput,
  type LineInput,
  type OrderInput,
  type ReceiveInput,
} from './model'

export { errorMessage }

export const purchasingApi = {
  async orders(input: {
    page?: number
    search?: string
    open?: boolean
    supplierUuid?: string
  }) {
    const page = input.page ?? 0
    return PurchasingModel.orders.parse(
      (
        await api.get<unknown>('/order/purchase-orders/', {
          params: {
            limit: 20,
            offset: page * 20,
            search: input.search || undefined,
            ...(input.open === undefined ? {} : { open: input.open }),
            ...(input.supplierUuid === undefined
              ? {}
              : { supplierUuid: input.supplierUuid }),
          },
        })
      ).data
    )
  },
  async order(uuid: string) {
    return PurchasingModel.order.parse(
      (await api.get<unknown>(`/order/purchase-orders/${uuid}`)).data
    )
  },
  async createOrder(body: OrderInput) {
    return PurchasingModel.order.parse(
      (await api.post<unknown>('/order/purchase-orders/', body)).data
    )
  },
  async act(
    uuid: string,
    action: 'place' | 'hold' | 'cancel' | 'complete',
    body: { version: number; acceptIncomplete?: boolean }
  ) {
    return PurchasingModel.order.parse(
      (
        await api.post<unknown>(
          `/order/purchase-orders/${uuid}/${action}`,
          body
        )
      ).data
    )
  },
  async lines(orderUuid: string) {
    return PurchasingModel.lines.parse(
      (
        await api.get<unknown>(`/order/purchase-orders/${orderUuid}/lines/`, {
          params: { limit: 100, offset: 0 },
        })
      ).data
    )
  },
  async addLine(orderUuid: string, body: LineInput) {
    return PurchasingModel.line.parse(
      (
        await api.post<unknown>(
          `/order/purchase-orders/${orderUuid}/lines/`,
          body
        )
      ).data
    )
  },
  async removeLine(orderUuid: string, lineUuid: string, version: number) {
    return PurchasingModel.success.parse(
      (
        await api.delete<unknown>(
          `/order/purchase-orders/${orderUuid}/lines/${lineUuid}`,
          {
            params: { version },
          }
        )
      ).data
    )
  },
  async extras(orderUuid: string) {
    return PurchasingModel.extras.parse(
      (
        await api.get<unknown>(
          `/order/purchase-orders/${orderUuid}/extra-lines/`,
          { params: { limit: 100, offset: 0 } }
        )
      ).data
    )
  },
  async addExtra(orderUuid: string, body: ExtraInput) {
    return PurchasingModel.extra.parse(
      (
        await api.post<unknown>(
          `/order/purchase-orders/${orderUuid}/extra-lines/`,
          body
        )
      ).data
    )
  },
  async removeExtra(orderUuid: string, extraUuid: string, version: number) {
    return PurchasingModel.success.parse(
      (
        await api.delete<unknown>(
          `/order/purchase-orders/${orderUuid}/extra-lines/${extraUuid}`,
          { params: { version } }
        )
      ).data
    )
  },
  async receive(uuid: string, body: ReceiveInput) {
    return PurchasingModel.receivedItems.parse(
      (await api.post<unknown>(`/order/purchase-orders/${uuid}/receive/`, body))
        .data
    )
  },
}
