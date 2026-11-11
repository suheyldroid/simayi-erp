import { createContext, useContext } from 'react'
import type { OrganizationRecord } from './model'

export type OrganizationSettingsAccess = {
  /** Real native organization id from the verified slug boundary. */
  organizationId: string
  organization: OrganizationRecord
  /** Native roles of the session user inside this exact organization. */
  actorRoles: string[]
  /** Native owner/admin capabilities, proven by the live session. */
  canManage: boolean
  isOwner: boolean
  activeTeamId: string | null
  currentUserId: string
}

export const OrganizationSettingsAccessContext =
  createContext<OrganizationSettingsAccess | null>(null)

/**
 * Access proven by the organization settings page for the exact organization
 * in the URL. It is only available below that gate.
 */
export function useOrganizationSettingsAccess(): OrganizationSettingsAccess {
  const access = useContext(OrganizationSettingsAccessContext)
  if (!access)
    throw new Error(
      'Organization settings content requires the verified organization gate.'
    )
  return access
}
