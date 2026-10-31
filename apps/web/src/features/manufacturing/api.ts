import { api } from '@/lib/auth'
import { errorMessage } from '@/features/common/api'
import { StockModel } from '@/features/stock/model'
import {
  ManufacturingModel,
  manufacturingLists,
  type BuildOrder,
} from './model'

export { errorMessage }

export const manufacturingApi = {
  async builds(input: { page: number; search: string; open: boolean }) {
    return manufacturingLists.builds.parse(
      (
        await api.get<unknown>('/build/builds/', {
          params: {
            limit: 20,
            offset: input.page * 20,
            search: input.search || undefined,
            open: input.open,
          },
        })
      ).data
    )
  },
  async build(id: number) {
    return ManufacturingModel.build.parse(
      (await api.get<unknown>(`/build/builds/${id}`)).data
    )
  },
  async create(body: {
    partId: number
    quantity: number
    title?: string
    reference?: string
    destinationId?: number | null
    takeFromId?: number | null
    targetDate?: string | null
  }) {
    return ManufacturingModel.build.parse(
      (await api.post<unknown>('/build/builds/', body)).data
    )
  },
  async remove(build: BuildOrder) {
    return ManufacturingModel.success.parse(
      (
        await api.delete<unknown>(`/build/builds/${build.id}`, {
          params: { version: build.version },
        })
      ).data
    )
  },
  async act(
    id: number,
    action: 'issue' | 'hold' | 'cancel' | 'complete',
    body: {
      version: number
      acceptIncomplete?: boolean
      acceptUnallocated?: boolean
    }
  ) {
    return ManufacturingModel.build.parse(
      (await api.post<unknown>(`/build/builds/${id}/${action}`, body)).data
    )
  },
  async lines(buildId: number) {
    return manufacturingLists.lines.parse(
      (
        await api.get<unknown>(`/build/builds/${buildId}/lines/`, {
          params: { limit: 100, offset: 0 },
        })
      ).data
    )
  },
  async allocations(buildId: number) {
    return manufacturingLists.allocations.parse(
      (
        await api.get<unknown>(`/build/builds/${buildId}/allocations/`, {
          params: { limit: 100, offset: 0 },
        })
      ).data
    )
  },
  async allocate(
    buildId: number,
    body: {
      version: number
      items: Array<{
        buildLineId: number
        stockItemId: number
        quantity: string
        outputId?: number | null
      }>
    }
  ) {
    return ManufacturingModel.build.parse(
      (await api.post<unknown>(`/build/builds/${buildId}/allocations/`, body))
        .data
    )
  },
  async removeAllocation(
    buildId: number,
    allocationId: number,
    version: number
  ) {
    return ManufacturingModel.build.parse(
      (
        await api.delete<unknown>(
          `/build/builds/${buildId}/allocations/${allocationId}`,
          { params: { version } }
        )
      ).data
    )
  },
  async consume(buildId: number, version: number, allocationIds: number[]) {
    return ManufacturingModel.build.parse(
      (
        await api.post<unknown>(`/build/builds/${buildId}/consume`, {
          version,
          allocationIds,
        })
      ).data
    )
  },
  async outputs(buildId: number) {
    return StockModel.stockItems.parse(
      (
        await api.get<unknown>(`/build/builds/${buildId}/outputs/`, {
          params: { limit: 100, offset: 0 },
        })
      ).data
    )
  },
  async createOutput(
    buildId: number,
    body: {
      version: number
      quantity: string
      serials?: string
      batch?: string | null
      locationId?: number | null
    }
  ) {
    return ManufacturingModel.build.parse(
      (await api.post<unknown>(`/build/builds/${buildId}/outputs/`, body)).data
    )
  },
  async finishOutput(
    buildId: number,
    outputId: number,
    body: {
      version: number
      quantity?: string
      acceptIncompleteAllocation?: boolean
    }
  ) {
    return ManufacturingModel.build.parse(
      (
        await api.post<unknown>(
          `/build/builds/${buildId}/outputs/${outputId}/complete`,
          body
        )
      ).data
    )
  },
  async scrapOutput(buildId: number, outputId: number, version: number) {
    return ManufacturingModel.build.parse(
      (
        await api.post<unknown>(
          `/build/builds/${buildId}/outputs/${outputId}/scrap`,
          { version }
        )
      ).data
    )
  },
}
