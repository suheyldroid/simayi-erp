import { api } from '@/lib/auth'
import { errorMessage } from '@/features/common/api'
import {
  StockModel,
  type LocationInput,
  type LocationTypeInput,
  type ResultInput,
  type StockInput,
  type TemplateInput,
} from './model'

export { errorMessage }

export const stockApi = {
  async locationTypes(page = 0, search = '') {
    return StockModel.locationTypes.parse(
      (
        await api.get<unknown>('/stock/location-types/', {
          params: { limit: 50, offset: page * 50, search },
        })
      ).data
    )
  },
  async saveLocationType(body: LocationTypeInput, id?: number) {
    return StockModel.locationType.parse(
      (id === undefined
        ? await api.post<unknown>('/stock/location-types/', body)
        : await api.patch<unknown>(`/stock/location-types/${id}`, body)
      ).data
    )
  },
  async removeLocationType(id: number) {
    return StockModel.success.parse(
      (await api.delete<unknown>(`/stock/location-types/${id}`)).data
    )
  },
  async locations(input: {
    page?: number
    search?: string
    roots?: boolean
    parentId?: number
  }) {
    const page = input.page ?? 0
    return StockModel.locations.parse(
      (
        await api.get<unknown>('/stock/locations/', {
          params: {
            limit: 100,
            offset: page * 100,
            search: input.search || undefined,
            roots: input.roots ? true : undefined,
            parentId: input.parentId,
          },
        })
      ).data
    )
  },
  async saveLocation(body: LocationInput, id?: number) {
    return StockModel.location.parse(
      (id === undefined
        ? await api.post<unknown>('/stock/locations/', body)
        : await api.patch<unknown>(`/stock/locations/${id}`, body)
      ).data
    )
  },
  async removeLocation(id: number) {
    return StockModel.success.parse(
      (await api.delete<unknown>(`/stock/locations/${id}`)).data
    )
  },
  async items(input: {
    page?: number
    search?: string
    partId?: number
    locationId?: number
    limit?: number
  }) {
    const page = input.page ?? 0
    const limit = input.limit ?? 20
    return StockModel.stockItems.parse(
      (
        await api.get<unknown>('/stock/items/', {
          params: {
            limit,
            offset: page * limit,
            search: input.search || undefined,
            partId: input.partId,
            locationId: input.locationId,
          },
        })
      ).data
    )
  },
  async createItems(body: StockInput) {
    return StockModel.createdStock.parse(
      (await api.post<unknown>('/stock/items/', body)).data
    )
  },
  async removeItem(id: number, version: number) {
    return StockModel.success.parse(
      (await api.delete<unknown>(`/stock/items/${id}`, { params: { version } }))
        .data
    )
  },
  async addQuantity(
    id: number,
    body: { version: number; quantity: string; notes?: string }
  ) {
    return StockModel.adjustment.parse(
      (await api.post<unknown>(`/stock/items/${id}/add`, body)).data
    )
  },
  async removeQuantity(
    id: number,
    body: { version: number; quantity: string; notes?: string }
  ) {
    return StockModel.adjustment.parse(
      (await api.post<unknown>(`/stock/items/${id}/remove`, body)).data
    )
  },
  async countItem(
    id: number,
    body: {
      version: number
      quantity: string
      locationId?: number
      notes?: string
    }
  ) {
    return StockModel.adjustment.parse(
      (await api.post<unknown>(`/stock/items/${id}/count`, body)).data
    )
  },
  async moveItem(
    id: number,
    body: { version: number; locationId: number; notes?: string }
  ) {
    return StockModel.adjustment.parse(
      (await api.post<unknown>(`/stock/items/${id}/move`, body)).data
    )
  },
  async itemTracking(id: number) {
    return StockModel.tracking.parse(
      (
        await api.get<unknown>(`/stock/items/${id}/tracking/`, {
          params: { limit: 50, offset: 0 },
        })
      ).data
    )
  },
  async partTracking(partId: number) {
    return StockModel.tracking.parse(
      (
        await api.get<unknown>(`/part/parts/${partId}/tracking/`, {
          params: { limit: 50, offset: 0 },
        })
      ).data
    )
  },
  async testTemplates(partId: number) {
    return StockModel.testTemplates.parse(
      (
        await api.get<unknown>(`/part/parts/${partId}/tests/`, {
          params: { limit: 100, offset: 0 },
        })
      ).data
    )
  },
  async saveTestTemplate(partId: number, body: TemplateInput, id?: number) {
    return StockModel.testTemplate.parse(
      (id === undefined
        ? await api.post<unknown>(`/part/parts/${partId}/tests/`, body)
        : await api.patch<unknown>(`/part/parts/${partId}/tests/${id}`, body)
      ).data
    )
  },
  async removeTestTemplate(partId: number, id: number) {
    return StockModel.success.parse(
      (await api.delete<unknown>(`/part/parts/${partId}/tests/${id}`)).data
    )
  },
  async testResults(stockItemId: number) {
    return StockModel.testResults.parse(
      (
        await api.get<unknown>(`/stock/items/${stockItemId}/tests/`, {
          params: { limit: 50, offset: 0 },
        })
      ).data
    )
  },
  async addTestResult(stockItemId: number, body: ResultInput) {
    return StockModel.testResult.parse(
      (await api.post<unknown>(`/stock/items/${stockItemId}/tests/`, body)).data
    )
  },
  async removeTestResult(stockItemId: number, id: number) {
    return StockModel.success.parse(
      (await api.delete<unknown>(`/stock/items/${stockItemId}/tests/${id}`))
        .data
    )
  },
}
