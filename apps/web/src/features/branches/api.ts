import { queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/auth'
import { organizationCacheScope } from '@/lib/tenant'
import { BranchesModel, type Branch, type BranchInput } from './model'

export { errorMessage } from '@/lib/api-error'

const pageParams = (page: number, search: string, limit: number) => ({
  limit,
  offset: page * limit,
  search: search || undefined,
})

const branchKeys = {
  list: (
    scope: string,
    page: number,
    search: string,
    limit: number,
    active?: boolean
  ) => ['branch', scope, 'list', page, search, limit, active ?? 'all'] as const,
  detail: (scope: string, uuid: string) =>
    ['branch', scope, 'detail', uuid] as const,
}

/**
 * Company branch directory. Branch management is organization-scoped: these
 * calls use the company client and never send a branch header.
 */
export const branchesApi = {
  async list(
    input: {
      page?: number
      search?: string
      limit?: number
      active?: boolean
    },
    signal?: AbortSignal
  ) {
    const page = input.page ?? 0
    return BranchesModel.branches.parse(
      (
        await api.get<unknown>('/branches/', {
          params: {
            ...pageParams(page, input.search ?? '', input.limit ?? 20),
            active: input.active,
          },
          signal,
        })
      ).data
    )
  },
  async branch(uuid: string, signal?: AbortSignal) {
    return BranchesModel.branch.parse(
      (await api.get<unknown>(`/branches/${uuid}`, { signal })).data
    )
  },
  async create(body: BranchInput) {
    return BranchesModel.branch.parse(
      (await api.post<unknown>('/branches/', body)).data
    )
  },
  async update(uuid: string, body: BranchInput & { version: number }) {
    return BranchesModel.branch.parse(
      (await api.patch<unknown>(`/branches/${uuid}`, body)).data
    )
  },
  async setActive(uuid: string, body: { active: boolean; version: number }) {
    return BranchesModel.branch.parse(
      (await api.patch<unknown>(`/branches/${uuid}`, body)).data
    )
  },
}

export function branchesListQueryOptions({
  page: rawPage,
  search: rawSearch,
  limit,
  active,
}: {
  page?: number
  search?: string
  limit?: number
  active?: boolean
}) {
  const page = rawPage ?? 0
  const search = rawSearch ?? ''
  const pageSize = limit ?? 20
  return queryOptions({
    queryKey: branchKeys.list(
      organizationCacheScope(),
      page,
      search,
      pageSize,
      active
    ),
    queryFn: ({ signal }) =>
      branchesApi.list({ page, search, limit: pageSize, active }, signal),
  })
}

export function branchDetailQueryOptions(uuid: string) {
  return queryOptions({
    queryKey: branchKeys.detail(organizationCacheScope(), uuid),
    queryFn: ({ signal }) => branchesApi.branch(uuid, signal),
    // The slug boundary treats a missing branch as not-found; retrying a 404
    // would delay the fail-closed decision.
    retry: false,
    staleTime: 0,
  })
}

export function branchesCacheKeys() {
  return branchKeys
}

export type { Branch, BranchInput }
