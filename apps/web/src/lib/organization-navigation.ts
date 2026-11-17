import { useParams } from '@tanstack/react-router'
import { useOptionalBranch } from '@/lib/branch-boundary'
import { useOrganizationSlug } from '@/lib/organization-boundary'

/**
 * Organization-relative destinations. The same closed target set is served by
 * both shells: the company shell (`/o/<slug><target>`) and the branch shell
 * (`/o/<slug>/b/<branchUuid><target>`). Feature code never writes either URL
 * itself; it builds one of these targets and hands it to
 * `organizationLocation`, so a link or navigation can never mix a company slug
 * with a foreign branch or lose the verified scope.
 *
 * `''` is the organization dashboard (`/o/<slug>` or
 * `/o/<slug>/b/<branchUuid>`).
 */
export const organizationTargets = [
  '',
  '/stock',
  '/stock/$itemId',
  '/sales',
  '/sales/$saleId',
  '/sales/batches',
  '/sales/batches/$batchId',
  '/purchasing',
  '/purchasing/$orderId',
  '/pos-devices',
  '/pos-devices/$deviceId',
  '/pos-devices/$deviceId/z-reports',
  '/pos-devices/$deviceId/z-reports/$reportId',
  '/finance',
  '/finance/$movementId',
  '/supplier',
  '/supplier/$supplierId',
  '/settings',
  '/settings/manage',
  '/settings/members',
  '/settings/teams',
  '/settings/items',
  '/settings/items/$itemId',
  '/settings/item-categories',
  '/settings/item-categories/$categoryId',
  '/settings/recipes',
  '/settings/recipes/$recipeId',
  '/settings/branches',
  '/settings/branches/$branchId',
] as const

export type OrganizationTarget = (typeof organizationTargets)[number]

/** Path params each target needs in addition to the scope params. */
export type OrganizationTargetParams = {
  '': Record<never, never>
  '/stock': Record<never, never>
  '/stock/$itemId': { itemId: string }
  '/sales': Record<never, never>
  '/sales/$saleId': { saleId: string }
  '/sales/batches': Record<never, never>
  '/sales/batches/$batchId': { batchId: string }
  '/purchasing': Record<never, never>
  '/purchasing/$orderId': { orderId: string }
  '/pos-devices': Record<never, never>
  '/pos-devices/$deviceId': { deviceId: string }
  '/pos-devices/$deviceId/z-reports': { deviceId: string }
  '/pos-devices/$deviceId/z-reports/$reportId': {
    deviceId: string
    reportId: string
  }
  '/finance': Record<never, never>
  '/finance/$movementId': { movementId: string }
  '/supplier': Record<never, never>
  '/supplier/$supplierId': { supplierId: string }
  '/settings': Record<never, never>
  '/settings/manage': Record<never, never>
  '/settings/members': Record<never, never>
  '/settings/teams': Record<never, never>
  '/settings/items': Record<never, never>
  '/settings/items/$itemId': { itemId: string }
  '/settings/item-categories': Record<never, never>
  '/settings/item-categories/$categoryId': { categoryId: string }
  '/settings/recipes': Record<never, never>
  '/settings/recipes/$recipeId': { recipeId: string }
  '/settings/branches': Record<never, never>
  '/settings/branches/$branchId': { branchId: string }
}

/** Resource params for one target (never includes the scope params). */
export type OrganizationTargetResource<T extends OrganizationTarget> =
  OrganizationTargetParams[T]

type CompanyTargetPath<T extends OrganizationTarget> =
  `/o/$organizationSlug${T}`
type BranchTargetPath<T extends OrganizationTarget> =
  `/o/$organizationSlug/b/$branchUuid${T}`

/**
 * Router destination for one organization target. `to` is one of the two
 * registered scope paths; `params` carries the scope params plus the resource
 * params of the target, so the object is directly spreadable.
 */
export type OrganizationLocation<T extends OrganizationTarget> = {
  to: CompanyTargetPath<T> | BranchTargetPath<T>
  params: {
    organizationSlug: string
    branchUuid?: string
  } & OrganizationTargetParams[T]
}

/**
 * Destination for an organization-relative target in the requested scope.
 * `branchUuid === null` is the company scope (all organization records); any
 * other value is the already verified branch scope. Record-provenance links
 * pass the record's own branch here, never the ambient selection.
 *
 * The returned object is spreadable into `<Link>`, `navigate` and
 * `router.buildLocation`:
 *
 *   <Link {...organizationLocation(slug, branchUuid, '/stock/$itemId', { itemId })} />
 *
 * The two template literals are the only place scope URLs exist; the closed
 * `OrganizationTarget` union keeps them registered route paths.
 */
export function organizationLocation<T extends OrganizationTarget>(
  organizationSlug: string,
  branchUuid: string | null,
  target: T,
  params?: OrganizationTargetParams[T]
): OrganizationLocation<T> {
  const scoped =
    branchUuid === null
      ? { organizationSlug, ...params }
      : { organizationSlug, branchUuid, ...params }
  // The generic params object cannot be spread into a literal type by the
  // compiler, so this one assertion re-attaches the checked target params. The
  // target/params pairing itself is enforced by the signature above; no caller
  // URL is ever constructed outside this closed mapping.
  return {
    to:
      branchUuid === null
        ? `/o/$organizationSlug${target}`
        : `/o/$organizationSlug/b/$branchUuid${target}`,
    params: scoped,
  } as unknown as OrganizationLocation<T>
}

/**
 * Section (list) target for the current location. Branch and company shells
 * share this: switching scope keeps the resource section, but a detail UUID
 * from the previous scope can never leak into the new one, because it maps to
 * its list parent instead.
 */
export function organizationSectionTarget(
  pathname: string,
  organizationSlug: string
): OrganizationTarget {
  const root = `/o/${organizationSlug}`
  let relative =
    pathname === root
      ? ''
      : pathname.startsWith(`${root}/`)
        ? pathname.slice(root.length)
        : ''
  // Drop the branch scope segment: `/b/<uuid>/<section>` -> `/<section>`.
  if (relative.startsWith('/b/')) {
    const rest = relative.slice('/b/'.length)
    const slash = rest.indexOf('/')
    relative = slash === -1 ? '' : rest.slice(slash)
  }
  const section = relative.replace(/\/+$/, '')

  if (section === '' || section === '/') return ''
  if (section === '/stock' || section.startsWith('/stock/')) return '/stock'
  if (section.startsWith('/sales/batches')) return '/sales/batches'
  if (section === '/sales' || section.startsWith('/sales/')) return '/sales'
  if (section === '/purchasing' || section.startsWith('/purchasing/'))
    return '/purchasing'
  if (section === '/pos-devices' || section.startsWith('/pos-devices/'))
    return '/pos-devices'
  if (section === '/finance' || section.startsWith('/finance/'))
    return '/finance'
  if (section === '/supplier' || section.startsWith('/supplier/'))
    return '/supplier'
  if (section === '/settings' || section === '/settings/manage')
    return '/settings/manage'
  if (section === '/settings/members') return '/settings/members'
  if (section === '/settings/teams') return '/settings/teams'
  if (section === '/settings/items' || section.startsWith('/settings/items/'))
    return '/settings/items'
  if (
    section === '/settings/item-categories' ||
    section.startsWith('/settings/item-categories/')
  )
    return '/settings/item-categories'
  if (
    section === '/settings/recipes' ||
    section.startsWith('/settings/recipes/')
  )
    return '/settings/recipes'
  if (
    section === '/settings/branches' ||
    section.startsWith('/settings/branches/')
  )
    return '/settings/branches'
  return ''
}

/** Current verified scope read from the path, never from query/search. */
export function useOrganizationScope(): {
  organizationSlug: string
  branchUuid: string | null
} {
  const organizationSlug = useOrganizationSlug()
  const branchUuid = useOptionalBranch()?.branchUuid ?? null
  return { organizationSlug, branchUuid }
}

/** Resource ids that mirrored (company + branch) routes can carry. */
export type OrganizationResourceParams = {
  organizationSlug: string
  branchUuid: string | null
  itemId?: string
  saleId?: string
  batchId?: string
  orderId?: string
  deviceId?: string
  reportId?: string
  movementId?: string
  supplierId?: string
  recipeId?: string
  branchId?: string
  categoryId?: string
}

const resourceParamKeys = [
  'itemId',
  'saleId',
  'batchId',
  'orderId',
  'deviceId',
  'reportId',
  'movementId',
  'supplierId',
  'recipeId',
  'branchId',
  'categoryId',
] as const

function readParam(params: unknown, key: string): string | undefined {
  if (typeof params !== 'object' || params === null) return undefined
  const value = (params as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

/**
 * Params for a page rendered by both the company and the branch mirror of the
 * same resource. Replaces `getRouteApi('/_authenticated/o/$organizationSlug/
 * _workspace/...')` in feature components: a company-only route id does not
 * exist under `/b/$branchUuid`, so features read the mirrored params here.
 * The scope comes from the verified boundary, the resource ids from the leaf
 * match.
 */
export function useOrganizationResourceParams(): OrganizationResourceParams {
  const params: unknown = useParams({ strict: false })
  const { organizationSlug, branchUuid } = useOrganizationScope()
  const result: OrganizationResourceParams = {
    organizationSlug,
    branchUuid,
  }
  for (const key of resourceParamKeys) {
    const value = readParam(params, key)
    if (value !== undefined) result[key] = value
  }
  return result
}
