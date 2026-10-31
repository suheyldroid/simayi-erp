import { api } from '@/lib/auth'
import {
  SupplyModel,
  type ManufacturerInput,
  type PriceInput,
  type SupplierInput,
} from './supply-model'

const page = { limit: 50, offset: 0 }

export const supplyApi = {
  async manufacturerParts(input: { partId?: number; manufacturerId?: number }) {
    return SupplyModel.manufacturerParts.parse(
      (
        await api.get<unknown>('/company/manufacturer-parts/', {
          params: { ...page, ...input },
        })
      ).data
    )
  },
  async saveManufacturerPart(body: ManufacturerInput, id?: number) {
    return SupplyModel.manufacturerPart.parse(
      (
        id === undefined
          ? await api.post<unknown>('/company/manufacturer-parts/', body)
          : await api.patch<unknown>(`/company/manufacturer-parts/${id}`, body)
      ).data
    )
  },
  async removeManufacturerPart(id: number) {
    return SupplyModel.success.parse(
      (await api.delete<unknown>(`/company/manufacturer-parts/${id}`)).data
    )
  },
  async supplierParts(input: { partId?: number; supplierId?: number }) {
    return SupplyModel.supplierParts.parse(
      (
        await api.get<unknown>('/company/supplier-parts/', {
          params: { ...page, ...input },
        })
      ).data
    )
  },
  async saveSupplierPart(body: SupplierInput, id?: number) {
    return SupplyModel.supplierPart.parse(
      (
        id === undefined
          ? await api.post<unknown>('/company/supplier-parts/', body)
          : await api.patch<unknown>(`/company/supplier-parts/${id}`, body)
      ).data
    )
  },
  async removeSupplierPart(id: number) {
    return SupplyModel.success.parse(
      (await api.delete<unknown>(`/company/supplier-parts/${id}`)).data
    )
  },
  async prices(supplierPartId: number) {
    return SupplyModel.priceBreaks.parse(
      (
        await api.get<unknown>(
          `/company/supplier-parts/${supplierPartId}/prices/`,
          { params: page }
        )
      ).data
    )
  },
  async savePrice(supplierPartId: number, body: PriceInput, id?: number) {
    return SupplyModel.priceBreak.parse(
      (
        id === undefined
          ? await api.post<unknown>(
              `/company/supplier-parts/${supplierPartId}/prices/`,
              body
            )
          : await api.patch<unknown>(
              `/company/supplier-parts/${supplierPartId}/prices/${id}`,
              body
            )
      ).data
    )
  },
  async removePrice(supplierPartId: number, id: number) {
    return SupplyModel.success.parse(
      (
        await api.delete<unknown>(
          `/company/supplier-parts/${supplierPartId}/prices/${id}`
        )
      ).data
    )
  },
}
