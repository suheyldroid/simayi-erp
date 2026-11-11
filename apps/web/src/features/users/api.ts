import { z } from 'zod'
import { authClient, globalApi } from '@/lib/auth'
import { UsersModel, type UserProfileInput } from './model'

const limit = 20

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
    throw new Error(result.error?.message ?? 'Could not list users.')
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
        result.error.message ?? 'Could not load the user.',
        result.error.status
      )
    const user: unknown = result.data
    if (user == null) throw new UserRequestError('User not found.', 404)
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
