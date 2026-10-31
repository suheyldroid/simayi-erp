import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { api } from '@/lib/auth'
import {
  AccessModel,
  type ErpProfileInput,
  type OwnerInput,
  type PermissionAction,
  type Rule,
} from './access-model'

const userPath = (id: string) => encodeURIComponent(id)
export const accessApi = {
  async permissions() {
    return AccessModel.effective.parse(
      (await api.get<unknown>('/users/permissions/me')).data
    )
  },
  async check(scope: string, action: PermissionAction, ownerId?: number) {
    return AccessModel.check.parse(
      (
        await api.post<unknown>('/users/permissions/check', {
          scope,
          action,
          ownerId,
        })
      ).data
    )
  },
  async profile(id: string) {
    return AccessModel.profile.parse(
      (await api.get<unknown>(`/users/profiles/${userPath(id)}`)).data
    )
  },
  async updateProfile(id: string, body: ErpProfileInput) {
    return AccessModel.profile.parse(
      (await api.patch<unknown>(`/users/profiles/${userPath(id)}`, body)).data
    )
  },
  async groups(page = 0, search = '') {
    return AccessModel.groups.parse(
      (
        await api.get<unknown>('/users/groups/', {
          params: { limit: 20, offset: page * 20, search },
        })
      ).data
    )
  },
  async group(id: number) {
    return AccessModel.group.parse(
      (await api.get<unknown>(`/users/groups/${id}`)).data
    )
  },
  async createGroup(name: string) {
    return AccessModel.group.parse(
      (await api.post<unknown>('/users/groups/', { name })).data
    )
  },
  async renameGroup(id: number, name: string) {
    return AccessModel.group.parse(
      (await api.patch<unknown>(`/users/groups/${id}`, { name })).data
    )
  },
  async deleteGroup(id: number) {
    return AccessModel.success.parse(
      (await api.delete<unknown>(`/users/groups/${id}`)).data
    )
  },
  async memberships(id: string, offset = 0) {
    return AccessModel.memberships.parse(
      (
        await api.get<unknown>(`/users/memberships/${userPath(id)}`, {
          params: { limit: 100, offset },
        })
      ).data
    )
  },
  async members(id: number, page = 0) {
    return AccessModel.members.parse(
      (
        await api.get<unknown>(`/users/groups/${id}/members`, {
          params: { limit: 20, offset: page * 20 },
        })
      ).data
    )
  },
  async addMember(id: number, userId: string) {
    return AccessModel.success.parse(
      (
        await api.put<unknown>(
          `/users/groups/${id}/members/${userPath(userId)}`
        )
      ).data
    )
  },
  async removeMember(id: number, userId: string) {
    return AccessModel.success.parse(
      (
        await api.delete<unknown>(
          `/users/groups/${id}/members/${userPath(userId)}`
        )
      ).data
    )
  },
  async rules(id: number) {
    return AccessModel.rules.parse(
      (await api.get<unknown>(`/users/groups/${id}/rulesets`)).data
    )
  },
  async updateRules(id: number, rules: Rule[]) {
    return AccessModel.rules.parse(
      (await api.put<unknown>(`/users/groups/${id}/rulesets`, { rules })).data
    )
  },
  async owners(page = 0) {
    return AccessModel.owners.parse(
      (
        await api.get<unknown>('/users/owners/', {
          params: { limit: 20, offset: page * 20 },
        })
      ).data
    )
  },
  async createOwner(body: OwnerInput) {
    return AccessModel.owner.parse(
      (await api.post<unknown>('/users/owners/', body)).data
    )
  },
}
export async function refreshAccess(client: QueryClient) {
  await Promise.all(
    [
      'permissions',
      'groups',
      'group',
      'group-members',
      'group-rules',
      'user-groups',
      'erp-profile',
      'owners',
    ].map((key) => client.invalidateQueries({ queryKey: [key] }))
  )
}
export const permissionsQuery = queryOptions({
  queryKey: ['permissions'],
  queryFn: accessApi.permissions,
  staleTime: 0,
  retry: false,
  refetchOnWindowFocus: true,
  refetchInterval: 30_000,
})
