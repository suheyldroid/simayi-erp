import { errorMessage } from '@/lib/api-error'
import { api } from '@/lib/auth'
import type { BranchRecord } from '@/lib/branch-boundary'
import { branchesApi } from '@/features/branches/api'
import {
  PurchasingModel,
  type ExtraInput,
  type LineInput,
  type OrderInput,
  type PurchaseLine,
  type ReceiveInput,
  type ReverseInput,
} from './model'

export { errorMessage }

const RECEIPTS_PAGE_SIZE = 20

export const purchasingApi = {
  async orders(input: {
    page?: number
    search?: string
    open?: boolean
    supplierUuid?: string
    branchUuid?: string
    company?: boolean
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
            ...(input.branchUuid === undefined
              ? {}
              : { branchUuid: input.branchUuid }),
            ...(input.company === undefined ? {} : { company: input.company }),
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
    // Every page is read so the detail listing and the bulk receive form see
    // the whole line set, never only the first page of the API's page size.
    const limit = 100
    const seen = new Set<string>()
    const items: PurchaseLine[] = []
    const readPage = async (offset: number) =>
      PurchasingModel.lines.parse(
        (
          await api.get<unknown>(`/order/purchase-orders/${orderUuid}/lines/`, {
            params: { limit, offset },
          })
        ).data
      )
    let offset = 0
    let page = await readPage(offset)
    for (;;) {
      for (const line of page.items) {
        if (seen.has(line.uuid)) continue
        seen.add(line.uuid)
        items.push(line)
      }
      offset += page.items.length
      if (page.items.length < limit || offset >= page.total) break
      page = await readPage(offset)
    }
    return { items, total: page.total, limit, offset: 0 }
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
    return PurchasingModel.receiveResult.parse(
      (await api.post<unknown>(`/order/purchase-orders/${uuid}/receive/`, body))
        .data
    )
  },
  async receipts(
    orderUuid: string,
    input: { lineUuid?: string; branchUuid?: string; page?: number } = {}
  ) {
    const page = input.page ?? 0
    return PurchasingModel.receipts.parse(
      (
        await api.get<unknown>(
          `/order/purchase-orders/${orderUuid}/receipts/`,
          {
            params: {
              limit: RECEIPTS_PAGE_SIZE,
              offset: page * RECEIPTS_PAGE_SIZE,
              ...(input.lineUuid === undefined
                ? {}
                : { lineUuid: input.lineUuid }),
              ...(input.branchUuid === undefined
                ? {}
                : { branchUuid: input.branchUuid }),
            },
          }
        )
      ).data
    )
  },
  async reverse(orderUuid: string, receiptUuid: string, body: ReverseInput) {
    return PurchasingModel.reverseResult.parse(
      (
        await api.post<unknown>(
          `/order/purchase-orders/${orderUuid}/receipts/${receiptUuid}/reverse`,
          body
        )
      ).data
    )
  },
  /**
   * Same-company branches offered as receipt destinations. The company branch
   * directory is paginated, so every page is read; inactive branches stay in
   * the list and the picker refuses them because the backend does too.
   */
  async receiptBranches() {
    const limit = 100
    const items: BranchRecord[] = []
    for (let page = 0; ; page += 1) {
      const result = await branchesApi.list({ page, limit })
      items.push(...result.items)
      if (result.items.length < result.limit || items.length >= result.total)
        break
    }
    return items
  },
}
