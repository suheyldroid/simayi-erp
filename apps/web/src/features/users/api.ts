import { api } from '@/lib/auth'
import { UsersModel, type UserProfileInput } from './model'

export const usersApi = {
  async list(page: number, search = '') {
    const { data } = await api.get<unknown>('/users/', {
      params: { limit: 20, offset: page * 20, search },
    })
    return UsersModel.listResponse.parse(data)
  },
  async get(id: string) {
    const { data } = await api.get<unknown>(`/users/${encodeURIComponent(id)}`)
    return UsersModel.user.parse(data)
  },
  async updateProfile(id: string, body: UserProfileInput) {
    const { data } = await api.patch<unknown>(
      `/users/${encodeURIComponent(id)}`,
      body
    )
    return UsersModel.user.parse(data)
  },
  async setActive(id: string, isActive: boolean) {
    const { data } = await api.patch<unknown>(
      `/users/${encodeURIComponent(id)}/status`,
      { isActive }
    )
    return UsersModel.user.parse(data)
  },
}
