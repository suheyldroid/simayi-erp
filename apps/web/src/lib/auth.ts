import axios from 'axios'
import { queryOptions } from '@tanstack/react-query'
import { adminClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export interface SessionUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  isActive: boolean
  role: string
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,
})

export const authClient = createAuthClient({
  baseURL: api.defaults.baseURL,
  basePath: '/auth',
  plugins: [adminClient()],
})

export function isAdministrator(
  user: { role?: string | null } | null | undefined
) {
  return user?.role?.split(',').includes('admin') ?? false
}

export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: async (): Promise<SessionUser | null> => {
    try {
      const { data } = await api.get<{ user: SessionUser }>('/me')
      return data.user
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
  // Router navigation must never accept a different origin or auth-page loop.
  if (!path?.startsWith('/') || path.startsWith('//') || path.includes('\\'))
    return '/'
  try {
    const url = new URL(path, 'https://app.invalid')
    if (
      url.origin !== 'https://app.invalid' ||
      /^\/(sign-in|sign-up|forgot-password|clerk)([/?#-]|$)/.test(url.pathname)
    )
      return '/'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}
