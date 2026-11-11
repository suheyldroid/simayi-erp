import { errorMessage } from '@/lib/api-error'
import { api } from '@/lib/auth'
import { ItemCategoriesModel, type CategoryInput } from './model'

export { errorMessage }

const pageParams = (page: number, search: string, limit: number) => ({
  limit,
  offset: page * limit,
  search: search || undefined,
})

export const itemCategoryApi = {
  async categories(input: {
    page?: number
    search?: string
    roots?: boolean
    parentUuid?: string
    structural?: boolean
    limit?: number
  }) {
    const page = input.page ?? 0
    return ItemCategoriesModel.categories.parse(
      (
        await api.get<unknown>('/item-categories/', {
          params: {
            ...pageParams(page, input.search ?? '', input.limit ?? 100),
            roots: input.roots ? true : undefined,
            parentUuid: input.parentUuid,
            structural: input.structural,
          },
        })
      ).data
    )
  },
  async category(uuid: string) {
    return ItemCategoriesModel.category.parse(
      (await api.get<unknown>(`/item-categories/${uuid}`)).data
    )
  },
  async saveCategory(body: CategoryInput, uuid?: string) {
    return ItemCategoriesModel.category.parse(
      (uuid === undefined
        ? await api.post<unknown>('/item-categories/', body)
        : await api.patch<unknown>(`/item-categories/${uuid}`, body)
      ).data
    )
  },
  async removeCategory(uuid: string) {
    return ItemCategoriesModel.success.parse(
      (await api.delete<unknown>(`/item-categories/${uuid}`)).data
    )
  },
}
