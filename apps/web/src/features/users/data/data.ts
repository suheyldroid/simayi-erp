import { Shield, UserCheck, Users, CreditCard } from 'lucide-react'
import { t } from '@/lib/i18n'
import { type UserStatus } from './schema'

export const callTypes = new Map<UserStatus, string>([
  ['active', 'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200'],
  ['inactive', 'bg-neutral-300/40 border-neutral-300'],
  ['invited', 'bg-sky-200/40 text-sky-900 dark:text-sky-100 border-sky-300'],
  [
    'suspended',
    'bg-destructive text-destructive-foreground border-destructive',
  ],
])

/** Display label for a management status enum value. */
export function userStatusLabel(status: UserStatus) {
  return t(`global:users.management.filters.${status}`, {
    defaultValue: status,
  })
}

/** Display label for a management role enum value. */
export function userRoleValueLabel(role: string) {
  return t(`global:users.management.roles.${role}`, { defaultValue: role })
}

export const roles = [
  {
    label: t('global:users.management.roles.superadmin'),
    value: 'superadmin',
    icon: Shield,
  },
  {
    label: t('global:users.management.roles.admin'),
    value: 'admin',
    icon: UserCheck,
  },
  {
    label: t('global:users.management.roles.manager'),
    value: 'manager',
    icon: Users,
  },
  {
    label: t('global:users.management.roles.cashier'),
    value: 'cashier',
    icon: CreditCard,
  },
] as const
