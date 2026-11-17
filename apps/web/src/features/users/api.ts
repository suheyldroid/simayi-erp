import { z } from 'zod'
import { translatedServerMessage } from '@/lib/api-error'
import { authClient, globalApi } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { UsersModel, type UserProfileInput } from './model'

const limit = 20

/**
 * Native Better Auth failures arrive as English text. A message the shared
 * server-message resource knows is shown in Turkish; an unknown one keeps its
 * native text so no specific server detail is replaced by a vague fallback.
 */
export function nativeErrorText(message: string | undefined, fallback: string) {
  if (!message) return fallback
  return translatedServerMessage(message) ?? message
}

export type UserSearchField = 'name' | 'email'

/**
 * Native Better Auth admin errors carry an HTTP status but are not axios
 * errors. The Users detail page keys its not-found/forbidden states off it.
 */
export class UserRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'UserRequestError'
    this.status = status
  }
}

const adminListSchema = z.object({
  users: z.array(UsersModel.adminUser),
  total: z.number().int().nonnegative(),
})

async function listAdminUsers(query: {
  limit: number
  offset: number
  sortBy: 'createdAt'
  sortDirection: 'desc'
  searchValue?: string
  searchField?: 'name' | 'email'
  searchOperator?: 'contains'
}) {
  const result = await authClient.admin.listUsers({ query })
  if (result.error || result.data == null)
    throw new Error(
      nativeErrorText(result.error?.message, t('global:users.api.listFailed'))
    )
  const page = adminListSchema.parse(result.data)
  return {
    users: page.users,
    total: page.total,
    limit: query.limit,
    offset: query.offset,
  }
}

export const usersApi = {
  async list(page: number, search = '', searchField: UserSearchField = 'name') {
    const base = {
      limit,
      offset: page * limit,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    } as const
    const trimmed = search.trim()
    if (!trimmed) return listAdminUsers(base)
    return listAdminUsers({
      ...base,
      searchValue: trimmed,
      searchField,
      searchOperator: 'contains',
    })
  },
  async get(id: string) {
    // Native Better Auth admin read: no organization header, no tenant
    // projection, works without an active organization.
    const result = await authClient.admin.getUser({ query: { id } })
    if (result.error)
      throw new UserRequestError(
        nativeErrorText(result.error.message, t('global:users.api.loadFailed')),
        result.error.status
      )
    const user: unknown = result.data
    if (user == null)
      throw new UserRequestError(t('global:users.api.notFound'), 404)
    return UsersModel.adminUser.parse(user)
  },
  async updateProfile(id: string, body: UserProfileInput) {
    // Native account endpoints: never pinned to an organization.
    const { data } = await globalApi.patch<unknown>(
      `/users/${encodeURIComponent(id)}`,
      body
    )
    return UsersModel.user.parse(data)
  },
  async setActive(id: string, isActive: boolean) {
    const { data } = await globalApi.patch<unknown>(
      `/users/${encodeURIComponent(id)}/status`,
      { isActive }
    )
    return UsersModel.user.parse(data)
  },
}
