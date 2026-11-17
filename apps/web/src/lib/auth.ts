import { z } from 'zod'
import axios, { AxiosHeaders, type AxiosInstance } from 'axios'
import { queryOptions } from '@tanstack/react-query'
import { adminClient, organizationClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { BRANCH_HEADER, getBranchRequestSignal } from '@/lib/branch-scope'
import { t } from '@/lib/i18n'
import {
  ORGANIZATION_HEADER,
  getPinnedOrganizationId,
  isOrganizationFrozen,
  noteSessionOrganization,
} from '@/lib/tenant'

export interface SessionUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  isActive: boolean
  role: string
}

/**
 * Native account session. It carries identity and organization pointers only,
 * so global system pages can read the account without touching tenant data.
 */
export interface GlobalSession {
  user: SessionUser
  session: {
    id: string
    activeOrganizationId: string | null
    activeTeamId: string | null
  }
}

/**
 * Account session returned by `/me`: identity plus native organization/team
 * pointers only. Business authorization is not projected into the session.
 */
export type AccountSession = GlobalSession

const accountSessionSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullable(),
    isActive: z.boolean(),
    role: z.string(),
  }),
  session: z.object({
    id: z.string(),
    activeOrganizationId: z.string().nullable(),
    activeTeamId: z.string().nullable(),
  }),
})

const nativeSessionSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullish(),
    isActive: z.boolean().nullish(),
    banned: z.boolean().nullish(),
    role: z.string().nullish(),
  }),
  session: z.object({
    id: z.string(),
    activeOrganizationId: z.string().nullish(),
    activeTeamId: z.string().nullish(),
  }),
})

/**
 * Tenant HTTP client. Business requests are pinned to the active organization
 * and are rejected while an organization switch is in flight.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,
})

/**
 * Account HTTP client. It never attaches an organization header and never
 * depends on the organization pin/freeze state, so system pages stay global.
 */
export const globalApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,
})

/**
 * Branch HTTP client. Branch-sensitive requests pass the captured branch UUID
 * explicitly as request config: `branchApi.get(url, { branchUuid })`. Company
 * and global requests stay on `api`/`globalApi` and never send this header.
 */
export const branchApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,
})

export const authClient = createAuthClient({
  baseURL: api.defaults.baseURL,
  basePath: '/auth',
  plugins: [
    adminClient(),
    organizationClient({
      teams: { enabled: true },
    }),
  ],
})

api.interceptors.request.use((config) => {
  const headers = AxiosHeaders.from(config.headers)
  if (isOrganizationFrozen()) {
    return Promise.reject(
      new axios.CanceledError('Organization switch in progress')
    )
  }
  const organizationId = getPinnedOrganizationId()
  if (organizationId) headers.set(ORGANIZATION_HEADER, organizationId)
  config.headers = headers
  return config
})

branchApi.interceptors.request.use((config) => {
  const headers = AxiosHeaders.from(config.headers)
  if (isOrganizationFrozen()) {
    return Promise.reject(
      new axios.CanceledError('Organization switch in progress')
    )
  }
  if (!config.branchUuid) {
    return Promise.reject(
      new axios.CanceledError('Branch request requires a branch')
    )
  }
  const organizationId = getPinnedOrganizationId()
  if (organizationId) headers.set(ORGANIZATION_HEADER, organizationId)
  headers.set(BRANCH_HEADER, config.branchUuid)
  config.headers = headers
  // Branch-transition abort: a pending request from the previous selection can
  // never resolve into the new branch subtree.
  if (!config.signal) config.signal = getBranchRequestSignal()
  return config
})

function responseCode(data: unknown) {
  if (typeof data !== 'object' || data === null) return undefined
  if (
    'error' in data &&
    typeof data.error === 'object' &&
    data.error !== null &&
    'code' in data.error &&
    typeof data.error.code === 'string'
  )
    return data.error.code
  if ('code' in data && typeof data.code === 'string') return data.code
  return undefined
}

export function isOrganizationMismatch(error: unknown) {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return false
  return responseCode(error.response.data) === 'ORGANIZATION_MISMATCH'
}

function reloadOnOrganizationMismatch(client: AxiosInstance) {
  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (isOrganizationMismatch(error)) {
        window.location.reload()
      }
      return Promise.reject(error)
    }
  )
}

reloadOnOrganizationMismatch(api)
reloadOnOrganizationMismatch(branchApi)

export function isAdministrator(
  user: { role?: string | null } | null | undefined
) {
  return user?.role?.split(',').includes('admin') ?? false
}

async function readGlobalSession(): Promise<GlobalSession | null> {
  const result = await authClient.getSession()
  if (result.error) {
    const failure: unknown = result.error
    const status =
      typeof failure === 'object' && failure !== null && 'status' in failure
        ? failure.status
        : undefined
    if (status === 401) return null
    throw new Error(
      result.error.message ?? t('common:states.accountLoadFailed')
    )
  }
  if (result.data == null) return null
  const parsed = nativeSessionSchema.parse(result.data)
  // Better Auth's native endpoint does not reject disabled or banned accounts;
  // the organization session does. Fail closed for both.
  if (parsed.user.banned === true || parsed.user.isActive === false) return null
  return {
    user: {
      id: parsed.user.id,
      name: parsed.user.name,
      email: parsed.user.email,
      emailVerified: parsed.user.emailVerified,
      image: parsed.user.image ?? null,
      isActive: true,
      role: parsed.user.role ?? 'user',
    },
    session: {
      id: parsed.session.id,
      activeOrganizationId: parsed.session.activeOrganizationId ?? null,
      activeTeamId: parsed.session.activeTeamId ?? null,
    },
  }
}

export async function readAccountSession(): Promise<AccountSession> {
  const { data } = await globalApi.get<unknown>('/me')
  return accountSessionSchema.parse(data)
}

/**
 * Global account query. Use it for system pages (dashboard, organization
 * directory, users, system settings, personal settings).
 */
export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: readGlobalSession,
  staleTime: 0,
  retry: false,
})

export const organizationSessionQueryKey = ['organization', 'session'] as const

/**
 * Organization session query. It establishes the tenant pin plus freeze/reload
 * behaviour and must only be read inside the organization boundary.
 */
export const organizationSessionQuery = queryOptions({
  queryKey: organizationSessionQueryKey,
  queryFn: async (): Promise<AccountSession | null> => {
    try {
      const session = await readAccountSession()
      if (
        noteSessionOrganization(session.session.activeOrganizationId) ===
        'reload'
      ) {
        window.location.reload()
      }
      return session
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401)
        return null
      throw error
    }
  },
  staleTime: 0,
  retry: false,
})

export function safeRedirect(path?: string) {
  if (!path?.startsWith('/') || path.startsWith('//') || path.includes('\\'))
    return '/'
  try {
    const url = new URL(path, 'https://app.invalid')
    if (
      url.origin !== 'https://app.invalid' ||
      /^\/(sign-in|sign-up|forgot-password)([/?#-]|$)/.test(url.pathname)
    )
      return '/'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}
