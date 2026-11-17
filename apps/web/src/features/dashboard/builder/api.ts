import axios from 'axios'
import { errorMessage } from '@/lib/api-error'
import { api, branchApi, globalApi } from '@/lib/auth'
import {
  dashboardCatalogSchema,
  dashboardDataSchema,
  dashboardDefinitionSchema,
  dashboardLayoutSchema,
  type DashboardBuilderScope,
  type DashboardData,
  type DashboardDefinition,
  type DashboardLayout,
  type DashboardWidget,
} from './model'

function client(scope: DashboardBuilderScope) {
  return scope.kind === 'global' ? globalApi : api
}

function endpoint(scope: DashboardBuilderScope, path: string) {
  return scope.kind === 'global'
    ? `/dashboard/${path}`
    : `/dashboard/organization/${path}`
}

/**
 * Personal dashboard endpoints. Global calls never attach a tenant header;
 * organization calls use the pinned tenant client and the resolved actor.
 */
export const dashboardBuilderApi = {
  async catalog(scope: DashboardBuilderScope) {
    const { data } = await client(scope).get<unknown>(
      endpoint(scope, 'catalog')
    )
    return dashboardCatalogSchema.parse(data)
  },
  async layout(scope: DashboardBuilderScope) {
    const { data } = await client(scope).get<unknown>(endpoint(scope, 'layout'))
    return dashboardLayoutSchema.parse(data)
  },
  async saveLayout(
    scope: DashboardBuilderScope,
    expectedRevision: number,
    definition: DashboardDefinition
  ): Promise<DashboardLayout> {
    const { data } = await client(scope).put<unknown>(
      endpoint(scope, 'layout'),
      {
        expectedRevision,
        definition: dashboardDefinitionSchema.parse(definition),
      }
    )
    return dashboardLayoutSchema.parse(data)
  },
  async data(
    scope: DashboardBuilderScope,
    widgets: DashboardWidget[]
  ): Promise<DashboardData> {
    if (widgets.length === 0)
      return { asOf: new Date().toISOString(), results: [] }
    const path = endpoint(scope, 'data')
    // Only organization business data is branch-filtered. Layout and catalog
    // stay company-wide, and global data is never branch-scoped.
    const request =
      scope.kind === 'organization' && scope.branchUuid
        ? branchApi.post<unknown>(
            path,
            { widgets },
            {
              branchUuid: scope.branchUuid,
            }
          )
        : client(scope).post<unknown>(path, { widgets })
    const { data } = await request
    return dashboardDataSchema.parse(data)
  },
}

/** True only for the API's dashboard revision conflict. */
export function isDashboardConflict(error: unknown) {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return false
  const body: unknown = error.response.data
  if (typeof body !== 'object' || body === null || !('error' in body))
    return false
  const payload = body.error
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'code' in payload &&
    payload.code === 'DASHBOARD_CONFLICT'
  )
}

export { errorMessage }
