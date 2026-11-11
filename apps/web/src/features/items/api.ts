import { errorMessage } from '@/lib/api-error'
import { api } from '@/lib/auth'
import { ItemsModel, type ItemInput } from './model'

export { errorMessage }

const pageParams = (page: number, search: string, limit: number) => ({
  limit,
  offset: page * limit,
  search: search || undefined,
})

export const itemApi = {
  async items(input: {
    page?: number
    search?: string
    categoryUuid?: string
    subcategories?: boolean
    active?: boolean
    limit?: number
  }) {
    const page = input.page ?? 0
    const limit = input.limit ?? 20
    return ItemsModel.items.parse(
      (
        await api.get<unknown>('/items/', {
          params: {
            ...pageParams(page, input.search ?? '', limit),
            categoryUuid: input.categoryUuid,
            subcategories: input.subcategories ? true : undefined,
            active: input.active,
          },
        })
      ).data
    )
  },
  async item(uuid: string) {
    return ItemsModel.item.parse(
      (await api.get<unknown>(`/items/${uuid}`)).data
    )
  },
  async saveItem(body: ItemInput, uuid?: string) {
    return ItemsModel.item.parse(
      (uuid === undefined
        ? await api.post<unknown>('/items/', body)
        : await api.patch<unknown>(`/items/${uuid}`, body)
      ).data
    )
  },
  async removeItem(uuid: string) {
    return ItemsModel.success.parse(
      (await api.delete<unknown>(`/items/${uuid}`)).data
    )
  },
}
