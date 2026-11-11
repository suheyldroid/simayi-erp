import { errorMessage } from '@/lib/api-error'
import { api } from '@/lib/auth'
import {
  RecipesModel,
  type RecipeCreateInput,
  type RecipeUpdateInput,
} from './model'

export { errorMessage }

export type RecipeListInput = {
  page?: number
  search?: string
  active?: boolean
  limit?: number
}

export const recipeApi = {
  async recipes(input: RecipeListInput = {}) {
    const page = input.page ?? 0
    const limit = input.limit ?? 20
    return RecipesModel.recipes.parse(
      (
        await api.get<unknown>('/recipes/', {
          params: {
            limit,
            offset: page * limit,
            search: input.search || undefined,
            active: input.active,
          },
        })
      ).data
    )
  },
  async recipe(uuid: string) {
    return RecipesModel.detail.parse(
      (await api.get<unknown>(`/recipes/${uuid}`)).data
    )
  },
  async create(body: RecipeCreateInput) {
    return RecipesModel.detail.parse(
      (await api.post<unknown>('/recipes/', body)).data
    )
  },
  async update(uuid: string, body: RecipeUpdateInput) {
    return RecipesModel.detail.parse(
      (await api.patch<unknown>(`/recipes/${uuid}`, body)).data
    )
  },
  async remove(uuid: string, version: number) {
    return RecipesModel.success.parse(
      (
        await api.delete<unknown>(`/recipes/${uuid}`, {
          params: { version },
        })
      ).data
    )
  },
}
