import { z } from 'zod'

export const actionFields = {
  view: 'canView',
  add: 'canAdd',
  change: 'canChange',
  delete: 'canDelete',
} as const
export type PermissionAction = keyof typeof actionFields
const rule = z.object({
  name: z.string(),
  canView: z.boolean(),
  canAdd: z.boolean(),
  canChange: z.boolean(),
  canDelete: z.boolean(),
})
const group = z.object({
  id: z.number().int(),
  name: z.string(),
  memberCount: z.number().int(),
  canManage: z.boolean(),
})
const brief = z.object({ id: z.number().int(), name: z.string() })
const paging = {
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
}
const profileFields = {
  language: z.string().nullable(),
  displayname: z.string().nullable(),
  position: z.string().nullable(),
  status: z.string().nullable(),
  location: z.string().nullable(),
  contact: z.string().nullable(),
  organisation: z.string().nullable(),
  active: z.boolean(),
  type: z.enum(['bot', 'internal', 'external', 'guest']),
  primaryGroupId: z.number().int().nullable(),
}
const owner = z.object({
  id: z.number().int(),
  kind: z.enum(['user', 'group']),
  userId: z.string().nullable(),
  groupId: z.number().int().nullable(),
  name: z.string(),
})
export const AccessModel = {
  rule,
  group,
  owner,
  effective: z.object({
    isAdministrator: z.boolean(),
    permissions: z.array(rule),
  }),
  groups: z.object({ groups: z.array(group), ...paging }),
  memberships: z.object({ groups: z.array(brief), ...paging }),
  members: z.object({
    members: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        role: z.string(),
        isActive: z.boolean(),
        banned: z.boolean(),
      })
    ),
    ...paging,
  }),
  rules: z.object({ groupId: z.number().int(), rules: z.array(rule) }),
  profile: z.object({
    id: z.number().int(),
    userId: z.string(),
    ...profileFields,
    primaryGroup: brief.nullable(),
    metadata: z.unknown(),
    theme: z.unknown(),
    widgets: z.unknown(),
  }),
  profileBody: z.object(profileFields).partial(),
  owners: z.object({ owners: z.array(owner), ...paging }),
  check: z.object({ allowed: z.boolean() }),
  success: z.object({ success: z.boolean() }),
}
export type EffectivePermissions = z.infer<typeof AccessModel.effective>
export type Group = z.infer<typeof group>
export type Rule = z.infer<typeof rule>
export type Owner = z.infer<typeof owner>
export type GroupMember = z.infer<typeof AccessModel.members>['members'][number]
export type ErpProfile = z.infer<typeof AccessModel.profile>
export type ErpProfileInput = z.infer<typeof AccessModel.profileBody>
export type OwnerInput =
  { kind: 'user'; userId: string } | { kind: 'group'; groupId: number }
export const profileTextFields = [
  { name: 'displayname', label: 'Display name', maxLength: 255 },
  { name: 'position', label: 'Position', maxLength: 255 },
  { name: 'language', label: 'Language', maxLength: 10 },
  { name: 'contact', label: 'Contact', maxLength: 255 },
  { name: 'organisation', label: 'Organisation', maxLength: 255 },
  { name: 'location', label: 'Location', maxLength: 2000 },
  { name: 'status', label: 'Status message', maxLength: 2000 },
] as const
export type ProfileFormValues = Record<
  (typeof profileTextFields)[number]['name'],
  string
> & { active: boolean; type: ErpProfile['type']; primaryGroupId: string }
export function hasPermission(
  value: EffectivePermissions | undefined,
  scope: string,
  action: PermissionAction
) {
  return (
    value?.permissions.find((rule) => rule.name === scope)?.[
      actionFields[action]
    ] ?? false
  )
}
