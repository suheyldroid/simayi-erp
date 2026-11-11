import { useQuery } from '@tanstack/react-query'
import { membershipQueryOptions } from '@/lib/organization-boundary'

/**
 * Native Better Auth membership list. It is global: no active organization or
 * organization role is needed to read it.
 */
export function useOrganizationMemberships() {
  return useQuery(membershipQueryOptions)
}
