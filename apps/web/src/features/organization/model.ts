import { z } from 'zod'
import { locale, t } from '@/lib/i18n'

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable().optional(),
})

export const memberSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  role: z.string(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
})

export const membersSchema = z.object({
  members: z.array(memberSchema),
  total: z.number().int().nonnegative(),
})

export const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  organizationId: z.string(),
})

export const teamMemberSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  userId: z.string(),
})

export const activeMemberSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  role: z.string(),
})

export const addedMemberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string(),
  role: z.string(),
})

export type OrganizationRecord = z.infer<typeof organizationSchema>
export type OrgMember = z.infer<typeof memberSchema>
export type OrgTeam = z.infer<typeof teamSchema>

/** Initials used by the shared organization avatar fallback. */
export function organizationInitials(
  organization: Pick<OrganizationRecord, 'name' | 'slug'>
) {
  const words = (organization.name.trim() || organization.slug.trim())
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
  if (words.length === 0) return '?'
  return words.map((word) => word[0]?.toLocaleUpperCase(locale) ?? '').join('')
}

/**
 * Native Better Auth organization roles. Role assignments are plain strings on
 * the membership; these are the only values the UI offers.
 */
export const organizationMemberRoles = ['owner', 'admin', 'member'] as const

export function splitMemberRoles(role: string) {
  return role
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

/**
 * Display label for a native role value. The stored value never changes; an
 * unknown (custom) role is shown verbatim.
 */
export function organizationRoleLabel(role: string) {
  return t(`global:organizationMembers.roles.${role}`, { defaultValue: role })
}

export function slugFromName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug.length > 0 ? slug : 'organization'
}
