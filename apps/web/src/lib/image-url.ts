import { api } from '@/lib/auth'

const absoluteReference = /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i

/**
 * Resolves a stored image reference against the API base exactly as the axios
 * client joins paths, so a base with a path prefix keeps working. Absolute
 * references (including historical external URLs) stay untouched so a preview
 * never rewrites a third-party address through the tenant API.
 */
export function imageUrl(image: string): string {
  if (absoluteReference.test(image)) return image
  const base = api.defaults.baseURL ?? window.location.origin
  return `${base.replace(/\/+$/, '')}/${image.replace(/^\/+/, '')}`
}
