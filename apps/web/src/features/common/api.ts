import { ZodError } from 'zod'
import axios from 'axios'
import { api } from '@/lib/auth'
import {
  CommonModel,
  type UnitInput,
  type ProjectInput,
  type StatusInput,
} from './model'

const params = (page: number, search: string) => ({
  limit: 20,
  offset: page * 20,
  search,
})
export function errorMessage(error: unknown) {
  if (error instanceof ZodError)
    return error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(' · ')
  if (axios.isAxiosError(error)) {
    const message: unknown = error.response?.data?.error?.message
    if (typeof message === 'string') return message
  }
  return 'Operation failed. Check the connection and your permissions, then retry.'
}
export const commonApi = {
  async settings(personal: boolean) {
    return CommonModel.settings.parse(
      (
        await api.get<unknown>(
          `/common/settings/${personal ? 'user' : 'system'}`
        )
      ).data
    )
  },
  async saveSetting(personal: boolean, key: string, value: string) {
    return CommonModel.setting.parse(
      (
        await api.put<unknown>(
          `/common/settings/${personal ? 'user' : 'system'}/${encodeURIComponent(key)}`,
          { value }
        )
      ).data
    )
  },
  async resetSetting(personal: boolean, key: string) {
    return CommonModel.setting.parse(
      (
        await api.delete<unknown>(
          `/common/settings/${personal ? 'user' : 'system'}/${encodeURIComponent(key)}`
        )
      ).data
    )
  },
  async units(page = 0, search = '') {
    return CommonModel.units.parse(
      (
        await api.get<unknown>('/common/units/', {
          params: params(page, search),
        })
      ).data
    )
  },
  async saveUnit(body: UnitInput, id?: number) {
    return CommonModel.unit.parse(
      (id === undefined
        ? await api.post<unknown>('/common/units/', body)
        : await api.put<unknown>(`/common/units/${id}`, body)
      ).data
    )
  },
  async projects(page = 0, search = '') {
    return CommonModel.projects.parse(
      (
        await api.get<unknown>('/common/projects/', {
          params: params(page, search),
        })
      ).data
    )
  },
  async saveProject(body: ProjectInput, id?: number) {
    return CommonModel.project.parse(
      (id === undefined
        ? await api.post<unknown>('/common/projects/', body)
        : await api.patch<unknown>(`/common/projects/${id}`, body)
      ).data
    )
  },
  async statuses(page = 0, search = '') {
    return CommonModel.statuses.parse(
      (
        await api.get<unknown>('/common/statuses/', {
          params: params(page, search),
        })
      ).data
    )
  },
  async saveStatus(body: StatusInput, id?: number) {
    return CommonModel.status.parse(
      (id === undefined
        ? await api.post<unknown>('/common/statuses/', body)
        : await api.put<unknown>(`/common/statuses/${id}`, body)
      ).data
    )
  },
  async catalog() {
    return CommonModel.catalog.parse(
      (await api.get<unknown>('/common/statuses/catalog')).data
    )
  },
  async modelTypes(page = 0, search = '') {
    return CommonModel.modelTypes.parse(
      (
        await api.get<unknown>('/common/model-types', {
          params: params(page, search),
        })
      ).data
    )
  },
  async allModelTypes() {
    const items = []
    for (let page = 0; ; page++) {
      const result = await commonApi.modelTypes(page)
      items.push(...result.items)
      if (result.offset + result.limit >= result.total) return items
      if (!result.items.length)
        throw new Error('Model type catalog changed; reload it.')
    }
  },
  async remove(resource: 'units' | 'projects' | 'statuses', id: number) {
    return CommonModel.success.parse(
      (await api.delete<unknown>(`/common/${resource}/${id}`)).data
    )
  },
  async convert(body: { amount: string; from: string; to: string }) {
    return CommonModel.conversion.parse(
      (await api.post<unknown>('/common/units/convert', body)).data
    )
  },
}
