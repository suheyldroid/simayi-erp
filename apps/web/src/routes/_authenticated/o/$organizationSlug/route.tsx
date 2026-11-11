import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { organizationSessionQuery } from '@/lib/auth'
import {
  membershipQueryOptions,
  organizationBoundaryTarget,
} from '@/lib/organization-boundary'
import { OrganizationLayout } from '@/components/layout/organization-layout'
import {
  organizationApi,
  OrganizationRequestError,
} from '@/features/organization/api'

/**
 * Native membership errors mean the account is no longer part of this
 * organization; every other failure (transport, 5xx, schema) must reach the
 * route error boundary instead of masquerading as a missing resource.
 */
function isMissingMembership(error: unknown) {
  if (!(error instanceof OrganizationRequestError)) return false
  if (error.status === 401 || error.status === 403 || error.status === 404)
    return true
  return (
    error.status === 400 &&
    (error.code === 'MEMBER_NOT_FOUND' ||
      error.code === 'NO_ACTIVE_ORGANIZATION')
  )
}

export const Route = createFileRoute('/_authenticated/o/$organizationSlug')({
  // This route has no loader, but the option keeps any future loader in the
  // organization subtree out of Link-intent preloads, where no boundary
  // verification has happened yet.
  preload: false,
  beforeLoad: async ({ context, params, location, preload }) => {
    // The slug must name a real native membership. Anything else fails closed
    // as not-found instead of rendering a tenant shell from a client segment.
    // The options use the default zero stale time, so this is a server read.
    const memberships = await context.queryClient.fetchQuery(
      membershipQueryOptions
    )
    const organization = memberships.find(
      (membership) => membership.slug === params.organizationSlug
    )
    if (!organization) throw notFound()

    // Hovering a Details link preloads this route. Membership resolution is
    // safe, but a preload must never act like entering the organization: no
    // native activation, no pin/freeze, no document reload and no tenant
    // session projection from a system page. The real navigation repeats this
    // guard with `preload === false` and verifies before the outlet mounts.
    if (preload) return { organization, organizationSlug: organization.slug }

    // Only a live account session may authorize tenant UI.
    const session = await context.queryClient.fetchQuery(
      organizationSessionQuery
    )
    if (!session) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }

    // The active session organization must match the URL membership.
    // Otherwise activate natively, then reload the exact requested canonical
    // URL. Children never mount in a mismatched tenant.
    if (session.session.activeOrganizationId !== organization.id) {
      const target = organizationBoundaryTarget(organization.slug, location)
      await organizationApi.enter(organization.id, target)
      throw redirect({
        href: new URL(target, window.location.origin).href,
        replace: true,
      })
    }

    // The membership list above can be a retained cache entry. Prove the
    // current membership against the native endpoint before mounting tenant UI
    // and fail closed when the account is no longer a member.
    const activeMember = await organizationApi
      .activeMember()
      .catch((error: unknown) => {
        if (isMissingMembership(error)) throw notFound()
        throw error
      })
    if (activeMember.organizationId !== organization.id) throw notFound()

    return { organization, organizationSlug: organization.slug }
  },
  component: OrganizationLayout,
})
