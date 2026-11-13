import { errorMessage } from '@/lib/api-error'
import { globalApi } from '@/lib/auth'
import { UnitsModel, type UnitInput, type UnitUpdateInput } from './model'

export { errorMessage }

const pageParams = (page: number, search: string, limit: number) => ({
  limit,
  offset: page * limit,
  search: search || undefined,
})

export const unitApi = {
  async units(input: {
    page?: number
    search?: string
    active?: boolean
    limit?: number
  }) {
    const page = input.page ?? 0
    return UnitsModel.units.parse(
      (
        await globalApi.get<unknown>('/units/', {
          params: {
            ...pageParams(page, input.search ?? '', input.limit ?? 20),
            ...(input.active === undefined ? {} : { active: input.active }),
          },
        })
      ).data
    )
  },
  async unit(uuid: string) {
    return UnitsModel.unit.parse(
      (await globalApi.get<unknown>(`/units/${uuid}`)).data
    )
  },
  async createUnit(body: UnitInput) {
    return UnitsModel.unit.parse(
      (await globalApi.post<unknown>('/units/', body)).data
    )
  },
  async updateUnit(uuid: string, body: UnitUpdateInput) {
    return UnitsModel.unit.parse(
      (await globalApi.patch<unknown>(`/units/${uuid}`, body)).data
    )
  },
  async removeUnit(uuid: string) {
    return UnitsModel.success.parse(
      (await globalApi.delete<unknown>(`/units/${uuid}`)).data
    )
  },
}
