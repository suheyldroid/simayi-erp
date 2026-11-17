import { errorMessage } from '@/lib/api-error'
import { api, branchApi } from '@/lib/auth'
import {
  RecipesModel,
  type RecipeActivationInput,
  type RecipeCreateInput,
  type RecipeCustomizeInput,
  type RecipeResetInput,
  type RecipeUpdateInput,
} from './model'

export { errorMessage }

export type RecipeListInput = {
  page?: number
  search?: string
  active?: boolean
  /**
   * Keep only definitions marked sellable. A direct-sale picker sends `true`;
   * an ingredient picker omits it so a nested recipe never has to be sellable.
   */
  sellable?: boolean
  limit?: number
  /**
   * Company templates only. The company index lists templates and every
   * branch's local recipes, but a company-template ingredient picker must
   * never offer a branch-local recipe.
   */
  templates?: boolean
}

type BranchUuid = string | null

/**
 * Recipe reads and writes are valid in company context (templates) and in
 * branch context (effective catalog, local recipes and customizations). The
 * branch UUID is always the one captured by the caller, never an ambient
 * selection read at settlement time.
 */
function get<T>(url: string, branchUuid: BranchUuid, params?: object) {
  return branchUuid === null
    ? api.get<T>(url, { params })
    : branchApi.get<T>(url, { branchUuid, params })
}

function post<T>(url: string, body: unknown, branchUuid: BranchUuid) {
  return branchUuid === null
    ? api.post<T>(url, body)
    : branchApi.post<T>(url, body, { branchUuid })
}

function patch<T>(url: string, body: unknown, branchUuid: BranchUuid) {
  return branchUuid === null
    ? api.patch<T>(url, body)
    : branchApi.patch<T>(url, body, { branchUuid })
}

export const recipeApi = {
  async recipes(input: RecipeListInput = {}, branchUuid: BranchUuid = null) {
    const page = input.page ?? 0
    const limit = input.limit ?? 20
    return RecipesModel.recipes.parse(
      (
        await get<unknown>('/recipes/', branchUuid, {
          limit,
          offset: page * limit,
          search: input.search || undefined,
          active: input.active,
          sellable: input.sellable,
          templates: input.templates ? true : undefined,
        })
      ).data
    )
  },
  async recipe(uuid: string, branchUuid: BranchUuid = null) {
    return RecipesModel.detail.parse(
      (await get<unknown>(`/recipes/${uuid}`, branchUuid)).data
    )
  },
  /** Company context creates a shared template; branch context a local recipe. */
  async create(body: RecipeCreateInput, branchUuid: BranchUuid = null) {
    return RecipesModel.detail.parse(
      (await post<unknown>('/recipes/', body, branchUuid)).data
    )
  },
  /** Company template, branch local recipe or branch customization by scope. */
  async update(
    uuid: string,
    body: RecipeUpdateInput,
    branchUuid: BranchUuid = null
  ) {
    return RecipesModel.detail.parse(
      (await patch<unknown>(`/recipes/${uuid}`, body, branchUuid)).data
    )
  },
  async remove(uuid: string, version: number, branchUuid: BranchUuid = null) {
    return RecipesModel.success.parse(
      (
        await (branchUuid === null
          ? api.delete<unknown>(`/recipes/${uuid}`, { params: { version } })
          : branchApi.delete<unknown>(`/recipes/${uuid}`, {
              branchUuid,
              params: { version },
            }))
      ).data
    )
  },
  /**
   * Branch activation of a shared company recipe. `version` is the current
   * assignment version, 0 when the branch has no assignment row yet.
   */
  async activation(
    uuid: string,
    body: RecipeActivationInput,
    branchUuid: string
  ) {
    return RecipesModel.detail.parse(
      (
        await branchApi.put<unknown>(`/recipes/${uuid}/activation`, body, {
          branchUuid,
        })
      ).data
    )
  },
  /** Copy the company template into a full, isolated branch customization. */
  async customize(
    uuid: string,
    body: RecipeCustomizeInput,
    branchUuid: string
  ) {
    return RecipesModel.detail.parse(
      (
        await branchApi.post<unknown>(`/recipes/${uuid}/customize`, body, {
          branchUuid,
        })
      ).data
    )
  },
  /** Drop the branch customization; the branch activation flag is preserved. */
  async reset(uuid: string, body: RecipeResetInput, branchUuid: string) {
    return RecipesModel.detail.parse(
      (
        await branchApi.post<unknown>(`/recipes/${uuid}/reset`, body, {
          branchUuid,
        })
      ).data
    )
  },
}
