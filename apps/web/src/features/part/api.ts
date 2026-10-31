import { api } from '@/lib/auth'
import { errorMessage } from '@/features/common/api'
import {
  PartModel,
  type CategoryInput,
  type CategoryParameterInput,
  type BomInput,
  type ParameterInput,
  type PartInput,
  type PriceInput,
  type TemplateInput,
} from './model'

export { errorMessage }

const pageParams = (page: number, search: string, limit: number) => ({
  limit,
  offset: page * limit,
  search: search || undefined,
})

export const partApi = {
  async categories(input: {
    page?: number
    search?: string
    roots?: boolean
    parentId?: number
  }) {
    const page = input.page ?? 0
    return PartModel.categories.parse(
      (
        await api.get<unknown>('/part/categories/', {
          params: {
            ...pageParams(page, input.search ?? '', 100),
            roots: input.roots ? true : undefined,
            parentId: input.parentId,
          },
        })
      ).data
    )
  },
  async saveCategory(body: CategoryInput, id?: number) {
    return PartModel.category.parse(
      (id === undefined
        ? await api.post<unknown>('/part/categories/', body)
        : await api.patch<unknown>(`/part/categories/${id}`, body)
      ).data
    )
  },
  async removeCategory(id: number) {
    return PartModel.success.parse(
      (await api.delete<unknown>(`/part/categories/${id}`)).data
    )
  },
  async categoryParameters(categoryId: number) {
    return PartModel.categoryParameters.parse(
      (
        await api.get<unknown>(`/part/categories/${categoryId}/parameters/`, {
          params: { limit: 100, offset: 0 },
        })
      ).data
    )
  },
  async saveCategoryParameter(
    categoryId: number,
    body: CategoryParameterInput,
    id?: number
  ) {
    return PartModel.categoryParameter.parse(
      (id === undefined
        ? await api.post<unknown>(
            `/part/categories/${categoryId}/parameters/`,
            body
          )
        : await api.patch<unknown>(
            `/part/categories/${categoryId}/parameters/${id}`,
            body
          )
      ).data
    )
  },
  async removeCategoryParameter(categoryId: number, id: number) {
    return PartModel.success.parse(
      (
        await api.delete<unknown>(
          `/part/categories/${categoryId}/parameters/${id}`
        )
      ).data
    )
  },
  async templates(page = 0, search = '') {
    return PartModel.templates.parse(
      (
        await api.get<unknown>('/part/templates/', {
          params: pageParams(page, search, 20),
        })
      ).data
    )
  },
  async saveTemplate(body: TemplateInput, id?: number) {
    return PartModel.template.parse(
      (id === undefined
        ? await api.post<unknown>('/part/templates/', body)
        : await api.patch<unknown>(`/part/templates/${id}`, body)
      ).data
    )
  },
  async removeTemplate(id: number) {
    return PartModel.success.parse(
      (await api.delete<unknown>(`/part/templates/${id}`)).data
    )
  },
  async parts(input: {
    page?: number
    search?: string
    categoryId?: number
    subcategories?: boolean
    variantOfId?: number
    revisionOfId?: number
    isTemplate?: boolean
    assembly?: boolean
    limit?: number
  }) {
    const page = input.page ?? 0
    const limit = input.limit ?? 20
    return PartModel.parts.parse(
      (
        await api.get<unknown>('/part/parts/', {
          params: {
            ...pageParams(page, input.search ?? '', limit),
            categoryId: input.categoryId,
            subcategories: input.subcategories ? true : undefined,
            variantOfId: input.variantOfId,
            revisionOfId: input.revisionOfId,
            isTemplate: input.isTemplate ? true : undefined,
            assembly: input.assembly ? true : undefined,
          },
        })
      ).data
    )
  },
  async savePart(body: PartInput, id?: number) {
    return PartModel.part.parse(
      (id === undefined
        ? await api.post<unknown>('/part/parts/', body)
        : await api.patch<unknown>(`/part/parts/${id}`, body)
      ).data
    )
  },
  async removePart(id: number) {
    return PartModel.success.parse(
      (await api.delete<unknown>(`/part/parts/${id}`)).data
    )
  },
  async parameters(partId: number) {
    return PartModel.parameters.parse(
      (
        await api.get<unknown>(`/part/parts/${partId}/parameters/`, {
          params: { limit: 100, offset: 0 },
        })
      ).data
    )
  },
  async saveParameter(partId: number, body: ParameterInput, id?: number) {
    return PartModel.parameter.parse(
      (id === undefined
        ? await api.post<unknown>(`/part/parts/${partId}/parameters/`, body)
        : await api.patch<unknown>(
            `/part/parts/${partId}/parameters/${id}`,
            body
          )
      ).data
    )
  },
  async removeParameter(partId: number, id: number, version: number) {
    return PartModel.removedParameter.parse(
      (
        await api.delete<unknown>(`/part/parts/${partId}/parameters/${id}`, {
          params: { version },
        })
      ).data
    )
  },
  async bom(partId: number, page = 0, search = '') {
    return PartModel.bom.parse(
      (
        await api.get<unknown>(`/part/parts/${partId}/bom/`, {
          params: pageParams(page, search, 50),
        })
      ).data
    )
  },
  async saveBom(partId: number, body: BomInput, id?: number) {
    return PartModel.bomLine.parse(
      (id === undefined
        ? await api.post<unknown>(`/part/parts/${partId}/bom/`, body)
        : await api.patch<unknown>(`/part/parts/${partId}/bom/${id}`, body)
      ).data
    )
  },
  async removeBom(partId: number, id: number) {
    return PartModel.success.parse(
      (await api.delete<unknown>(`/part/parts/${partId}/bom/${id}`)).data
    )
  },
  async validateBom(partId: number) {
    return PartModel.bomValidation.parse(
      (await api.post<unknown>(`/part/parts/${partId}/bom/validate`)).data
    )
  },
  async addSubstitute(partId: number, bomItemId: number, substituteId: number) {
    return PartModel.bomSubstitute.parse(
      (
        await api.post<unknown>(
          `/part/parts/${partId}/bom/${bomItemId}/substitutes/`,
          { partId: substituteId }
        )
      ).data
    )
  },
  async removeSubstitute(partId: number, bomItemId: number, id: number) {
    return PartModel.success.parse(
      (
        await api.delete<unknown>(
          `/part/parts/${partId}/bom/${bomItemId}/substitutes/${id}`
        )
      ).data
    )
  },
  async priceBreaks(kind: 'sell' | 'internal', partId: number) {
    const path = kind === 'sell' ? 'sell-prices' : 'internal-prices'
    return PartModel.priceBreaks.parse(
      (
        await api.get<unknown>(`/part/parts/${partId}/${path}/`, {
          params: { limit: 100, offset: 0 },
        })
      ).data
    )
  },
  async savePriceBreak(
    kind: 'sell' | 'internal',
    partId: number,
    body: PriceInput,
    id?: number
  ) {
    const path = kind === 'sell' ? 'sell-prices' : 'internal-prices'
    return PartModel.priceBreak.parse(
      (id === undefined
        ? await api.post<unknown>(`/part/parts/${partId}/${path}/`, body)
        : await api.patch<unknown>(`/part/parts/${partId}/${path}/${id}`, body)
      ).data
    )
  },
  async removePriceBreak(
    kind: 'sell' | 'internal',
    partId: number,
    id: number
  ) {
    const path = kind === 'sell' ? 'sell-prices' : 'internal-prices'
    return PartModel.success.parse(
      (await api.delete<unknown>(`/part/parts/${partId}/${path}/${id}`)).data
    )
  },
}
