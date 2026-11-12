import { queryOptions } from '@tanstack/react-query'
import { organizationCacheScope } from '@/lib/tenant'
import { dashboardBuilderApi } from './api'
import { dashboardDataSignature } from './definition'
import type { DashboardBuilderScope, DashboardWidget } from './model'

/**
 * Cache namespace for the current account and context. Global keys include the
 * native membership signature so a membership change refetches aggregates;
 * organization keys include the organization and the pinned tenant scope.
 */
export function builderScopeKey(scope: DashboardBuilderScope): string[] {
  return scope.kind === 'global'
    ? ['global', scope.accountId, scope.membershipSignature]
    : [
        'organization',
        scope.organizationId,
        organizationCacheScope(),
        scope.accountId,
      ]
}

export function dashboardCatalogQueryOptions(scope: DashboardBuilderScope) {
  return queryOptions({
    queryKey: ['dashboard', 'builder', ...builderScopeKey(scope), 'catalog'],
    queryFn: () => dashboardBuilderApi.catalog(scope),
    staleTime: 5 * 60_000,
  })
}

export function dashboardLayoutQueryOptions(scope: DashboardBuilderScope) {
  return queryOptions({
    queryKey: ['dashboard', 'builder', ...builderScopeKey(scope), 'layout'],
    queryFn: () => dashboardBuilderApi.layout(scope),
    staleTime: 0,
  })
}

/**
 * One bounded batch request for every visible widget. The key carries the
 * data-relevant widget configuration, so a config/filter change never shows a
 * stale result for the new card.
 */
export function dashboardDataQueryOptions(
  scope: DashboardBuilderScope,
  widgets: DashboardWidget[],
  enabled: boolean
) {
  return queryOptions({
    queryKey: [
      'dashboard',
      'builder',
      ...builderScopeKey(scope),
      'data',
      dashboardDataSignature(widgets),
    ],
    queryFn: () => dashboardBuilderApi.data(scope, widgets),
    enabled: enabled && widgets.length > 0,
    staleTime: 15_000,
  })
}
