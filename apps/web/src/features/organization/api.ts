import { z } from 'zod'
import axios from 'axios'
import { errorMessage, translatedServerMessage } from '@/lib/api-error'
import { api, authClient, readAccountSession } from '@/lib/auth'
import { t } from '@/lib/i18n'
import {
  assertSameOrganization,
  cancelOrganizationQueries,
  freezeOrganization,
  getPinnedOrganizationId,
  unfreezeOrganization,
} from '@/lib/tenant'
import {
  activeMemberSchema,
  addedMemberSchema,
  membersSchema,
  organizationSchema,
  teamMemberSchema,
  teamSchema,
} from './model'

type AuthResult<T> = {
  data: T | null
  error: { message?: string | undefined } | null
}

async function unwrap<T>(
  result: AuthResult<T>,
  parse: (value: unknown) => T,
  fallback: string
) {
  if (result.error || result.data == null)
    throw new Error(result.error?.message ?? fallback)
  return parse(result.data)
}

/**
 * Global membership list. It is not tenant-scoped and must stay shared by the
 * dashboard, the organization directory, the gate and the switcher.
 */
export const membershipListQueryKey = [
  'organization',
  'membership',
  'list',
] as const

function reloadDocument() {
  window.location.assign(`${window.location.pathname}${window.location.search}`)
}

/**
 * Resolve a requested post-activation target to a same-origin organization
 * path. Anything else (`/workspace`, another site, a non-organization route)
 * is refused before the activation request is sent.
 */
function organizationTarget(target: string) {
  const url = new URL(target, window.location.origin)
  if (
    url.origin !== window.location.origin ||
    !url.pathname.startsWith('/o/') ||
    url.pathname.length <= '/o/'.length
  )
    throw new Error(t('global:organizationApi.targetOutside'))
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * Canonical root URL for a native slug, used when switching organizations.
 */
export function organizationPath(slug: string) {
  return organizationTarget(`/o/${encodeURIComponent(slug)}`)
}

function authCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error))
    return undefined
  return typeof error.code === 'string' ? error.code : undefined
}

export function organizationErrorMessage(error: unknown) {
  // API envelopes, Zod issues and native error objects keep their shared
  // translation and status mapping.
  if (!(error instanceof Error) || axios.isAxiosError(error))
    return errorMessage(error)
  // Native Better Auth text raised as an Error is mapped through the shared
  // message resource; an already localized guard message passes through. An
  // empty message still surfaces a failure instead of an empty alert.
  if (error.message)
    return translatedServerMessage(error.message) ?? error.message
  return errorMessage(error)
}

export class OrganizationRequestError extends Error {
  readonly status: number
  readonly code: string | undefined

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'OrganizationRequestError'
    this.status = status
    this.code = code
  }
}

export const organizationApi = {
  async list() {
    return unwrap(
      await authClient.organization.list(),
      (value) => z.array(organizationSchema).parse(value),
      t('global:organizationApi.listFailed')
    )
  },
  async get(organizationId: string) {
    assertSameOrganization(organizationId)
    const result = await authClient.organization.getFullOrganization({
      query: { organizationId },
    })
    if (result.error)
      throw new OrganizationRequestError(
        result.error.message ?? t('global:organizationApi.loadFailed'),
        result.error.status
      )
    if (result.data == null)
      throw new OrganizationRequestError(
        t('global:organizationApi.notFound'),
        404
      )
    return organizationSchema.parse(result.data)
  },
  async checkSlug(slug: string) {
    const result = await authClient.organization.checkSlug({ slug })
    if (result.error) {
      if (authCode(result.error) === 'ORGANIZATION_SLUG_ALREADY_TAKEN')
        return false
      throw new Error(
        result.error.message ?? t('global:organizationApi.slugCheckFailed')
      )
    }
    if (result.data == null)
      throw new Error(t('global:organizationApi.slugCheckFailed'))
    return z.object({ status: z.boolean() }).parse(result.data).status
  },
  async create(input: {
    name: string
    slug: string
    logo?: string
    keepCurrentActiveOrganization?: boolean
  }) {
    return unwrap(
      await authClient.organization.create(input),
      (value) => organizationSchema.parse(value),
      t('global:organizationApi.createFailed')
    )
  },
  async update(
    organizationId: string,
    data: {
      name?: string
      slug?: string
      logo?: string | null
    }
  ) {
    assertSameOrganization(organizationId)
    const result = await authClient.organization.update({
      organizationId,
      data,
    })
    if (result.error)
      throw new Error(
        result.error.message ?? t('global:organizationApi.updateFailed')
      )
    return result.data ? organizationSchema.parse(result.data) : null
  },
  async remove(organizationId: string) {
    assertSameOrganization(organizationId)
    const session = await readAccountSession()
    if (session.session.activeOrganizationId !== organizationId)
      throw new Error(t('global:organizationApi.deleteOnlyActive'))
    freezeOrganization()
    await cancelOrganizationQueries()
    try {
      const result = await authClient.organization.delete({ organizationId })
      if (result.error)
        throw new Error(
          result.error.message ?? t('global:organizationApi.deleteFailed')
        )
      window.location.assign('/')
    } catch (error) {
      unfreezeOrganization()
      throw error
    }
  },
  /**
   * Native activation for the organization boundary and the organization
   * switcher. The post-activation target must be a canonical same-origin
   * organization URL (`/o/<slug>...`); a workspace path or foreign target is
   * rejected before anything is mutated.
   */
  async enter(organizationId: string, target: string) {
    const destination = organizationTarget(target)
    const previous = getPinnedOrganizationId()
    freezeOrganization()
    await cancelOrganizationQueries()
    try {
      const activated = await authClient.organization.setActive({
        organizationId,
      })
      if (activated.error)
        throw new Error(
          activated.error.message ?? t('global:organizationApi.selectFailed')
        )
      const session = await readAccountSession()
      if (session.session.activeOrganizationId !== organizationId) {
        // Restore the exact previous value, including "no active organization".
        await authClient.organization.setActive({ organizationId: previous })
        throw new Error(t('global:organizationApi.activeMismatch'))
      }
      window.location.assign(destination)
    } catch (error) {
      unfreezeOrganization()
      throw error
    }
  },
  async activeMember() {
    const result = await authClient.organization.getActiveMember()
    if (result.error)
      throw new OrganizationRequestError(
        result.error.message ??
          t('global:organizationApi.membershipLoadFailed'),
        result.error.status,
        authCode(result.error)
      )
    if (result.data == null)
      throw new OrganizationRequestError(
        t('global:organizationApi.membershipNotFound'),
        404
      )
    return activeMemberSchema.parse(result.data)
  },
  async members(organizationId: string, offset: number, limit = 20) {
    assertSameOrganization(organizationId)
    return unwrap(
      await authClient.organization.listMembers({
        query: { organizationId, limit, offset },
      }),
      (value) => membersSchema.parse(value),
      t('global:organizationApi.membersListFailed')
    )
  },
  async addMember(organizationId: string, userId: string, role: string[]) {
    assertSameOrganization(organizationId)
    return addedMemberSchema.parse(
      (await api.post<unknown>('/users/members', { userId, role })).data
    )
  },
  async updateMemberRole(
    organizationId: string,
    memberId: string,
    role: string[]
  ) {
    assertSameOrganization(organizationId)
    return addedMemberSchema.parse(
      (
        await api.patch<unknown>(`/users/members/${memberId}`, {
          role,
        })
      ).data
    )
  },
  async removeMember(organizationId: string, memberIdOrEmail: string) {
    assertSameOrganization(organizationId)
    const result = await authClient.organization.removeMember({
      organizationId,
      memberIdOrEmail,
    })
    if (result.error)
      throw new Error(
        result.error.message ?? t('global:organizationApi.memberRemoveFailed')
      )
  },
  async teams(organizationId: string) {
    assertSameOrganization(organizationId)
    return unwrap(
      await authClient.organization.listTeams({ query: { organizationId } }),
      (value) => z.array(teamSchema).parse(value),
      t('global:organizationApi.teamsListFailed')
    )
  },
  async createTeam(organizationId: string, name: string) {
    assertSameOrganization(organizationId)
    return unwrap(
      await authClient.organization.createTeam({ organizationId, name }),
      (value) => teamSchema.parse(value),
      t('global:organizationApi.teamCreateFailed')
    )
  },
  async updateTeam(organizationId: string, teamId: string, name: string) {
    assertSameOrganization(organizationId)
    return unwrap(
      await authClient.organization.updateTeam({ teamId, data: { name } }),
      (value) => teamSchema.parse(value),
      t('global:organizationApi.teamRenameFailed')
    )
  },
  async removeTeam(organizationId: string, teamId: string) {
    assertSameOrganization(organizationId)
    const session = await readAccountSession()
    if (session.session.activeOrganizationId !== organizationId)
      throw new Error(t('global:organizationApi.teamDeleteFromActive'))
    if (session.session.activeTeamId === teamId) {
      const cleared = await authClient.organization.setActiveTeam({
        teamId: null,
      })
      if (cleared.error)
        throw new Error(
          cleared.error.message ??
            t('global:organizationApi.activeTeamClearFailed')
        )
      const confirmed = await readAccountSession()
      if (
        confirmed.session.activeOrganizationId !== organizationId ||
        confirmed.session.activeTeamId === teamId
      )
        throw new Error(t('global:organizationApi.activeTeamStillDeleted'))
    }
    const result = await authClient.organization.removeTeam({
      organizationId,
      teamId,
    })
    if (result.error)
      throw new Error(
        result.error.message ?? t('global:organizationApi.teamDeleteFailed')
      )
  },
  async teamMembers(teamId: string) {
    return unwrap(
      await authClient.organization.listTeamMembers({ query: { teamId } }),
      (value) => z.array(teamMemberSchema).parse(value),
      t('global:organizationApi.teamMembersListFailed')
    )
  },
  async addTeamMember(organizationId: string, teamId: string, userId: string) {
    assertSameOrganization(organizationId)
    const result = await authClient.organization.addTeamMember({
      organizationId,
      teamId,
      userId,
    })
    if (result.error)
      throw new Error(
        result.error.message ?? t('global:organizationApi.teamMemberAddFailed')
      )
  },
  async removeTeamMember(
    organizationId: string,
    teamId: string,
    userId: string
  ) {
    assertSameOrganization(organizationId)
    const result = await authClient.organization.removeTeamMember({
      organizationId,
      teamId,
      userId,
    })
    if (result.error)
      throw new Error(
        result.error.message ??
          t('global:organizationApi.teamMemberRemoveFailed')
      )
  },
  async activateTeam(organizationId: string, teamId: string | null) {
    assertSameOrganization(organizationId)
    freezeOrganization()
    await cancelOrganizationQueries()
    try {
      const result = await authClient.organization.setActiveTeam({ teamId })
      if (result.error)
        throw new Error(
          result.error.message ??
            t('global:organizationApi.activeTeamChangeFailed')
        )
      const session = await readAccountSession()
      if (
        session.session.activeOrganizationId !== organizationId ||
        session.session.activeTeamId !== teamId
      ) {
        throw new Error(t('global:organizationApi.activeTeamMismatch'))
      }
      reloadDocument()
    } catch (error) {
      unfreezeOrganization()
      throw error
    }
  },
}
