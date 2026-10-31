import { api } from '@/lib/auth'
import { errorMessage } from '@/features/common/api'
import { StockModel } from '@/features/stock/model'
import {
  PurchasingModel,
  type ExtraInput,
  type LineInput,
  type OrderInput,
  type ReceiveInput,
} from './model'

export { errorMessage }

export const purchasingApi = {
  async orders(input: { page?: number; search?: string; open?: boolean }) {
    const page = input.page ?? 0
    return PurchasingModel.orders.parse(
      (
        await api.get<unknown>('/order/purchase-orders/', {
          params: {
            limit: 20,
            offset: page * 20,
            search: input.search || undefined,
            ...(input.open === undefined ? {} : { open: input.open }),
          },
        })
      ).data
    )
  },
  async order(id: number) {
    return PurchasingModel.order.parse(
      (await api.get<unknown>(`/order/purchase-orders/${id}`)).data
    )
  },
  async createOrder(body: OrderInput) {
    return PurchasingModel.order.parse(
      (await api.post<unknown>('/order/purchase-orders/', body)).data
    )
  },
  async removeOrder(id: number, version: number) {
    return PurchasingModel.success.parse(
      (
        await api.delete<unknown>(`/order/purchase-orders/${id}`, {
          params: { version },
        })
      ).data
    )
  },
  async act(
    id: number,
    action: 'place' | 'hold' | 'cancel' | 'complete',
    body: { version: number; acceptIncomplete?: boolean }
  ) {
    return PurchasingModel.order.parse(
      (await api.post<unknown>(`/order/purchase-orders/${id}/${action}`, body))
        .data
    )
  },
  async lines(orderId: number) {
    return PurchasingModel.lines.parse(
      (
        await api.get<unknown>(`/order/purchase-orders/${orderId}/lines/`, {
          params: { limit: 100, offset: 0 },
        })
      ).data
    )
  },
  async addLine(orderId: number, body: LineInput) {
    return PurchasingModel.line.parse(
      (
        await api.post<unknown>(
          `/order/purchase-orders/${orderId}/lines/`,
          body
        )
      ).data
    )
  },
  async removeLine(orderId: number, id: number, version: number) {
    return PurchasingModel.success.parse(
      (
        await api.delete<unknown>(
          `/order/purchase-orders/${orderId}/lines/${id}`,
          {
            params: { version },
          }
        )
      ).data
    )
  },
  async extras(orderId: number) {
    return PurchasingModel.extras.parse(
      (
        await api.get<unknown>(
          `/order/purchase-orders/${orderId}/extra-lines/`,
          { params: { limit: 100, offset: 0 } }
        )
      ).data
    )
  },
  async addExtra(orderId: number, body: ExtraInput) {
    return PurchasingModel.extra.parse(
      (
        await api.post<unknown>(
          `/order/purchase-orders/${orderId}/extra-lines/`,
          body
        )
      ).data
    )
  },
  async removeExtra(orderId: number, id: number, version: number) {
    return PurchasingModel.success.parse(
      (
        await api.delete<unknown>(
          `/order/purchase-orders/${orderId}/extra-lines/${id}`,
          { params: { version } }
        )
      ).data
    )
  },
  async receive(id: number, body: ReceiveInput) {
    return StockModel.createdStock.parse(
      (await api.post<unknown>(`/order/purchase-orders/${id}/receive/`, body))
        .data
    )
  },
}
