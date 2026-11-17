import { z } from 'zod'
import { t } from '@/lib/i18n'

/**
 * Native Better Auth account fields the current user may change. Email, role,
 * status and organization membership stay outside this form: Better Auth's
 * `updateUser` rejects email changes (changeEmail is disabled and no
 * verification sender is configured) and never accepts authorization fields.
 */
export const profileFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, t('global:settings.validation.nameRequired'))
    .max(150, t('global:settings.validation.nameTooLong')),
})

export type ProfileFormValues = z.infer<typeof profileFormSchema>

/**
 * Body for the native `authClient.updateUser` endpoint. The avatar value is
 * the current canonical reference, a newly uploaded one, or `null` after the
 * user removes it.
 */
export function profileUpdateInput(
  values: ProfileFormValues,
  image: string | null
) {
  return { name: values.name.trim(), image }
}
