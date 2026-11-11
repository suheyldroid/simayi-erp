import { z } from 'zod'

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
    .min(1, 'Enter a name.')
    .max(150, 'Name must not be longer than 150 characters.'),
  image: z
    .string()
    .trim()
    .max(2048, 'Avatar URL must not be longer than 2048 characters.')
    .refine(
      (value) =>
        value === '' ||
        (/^https?:\/\//i.test(value) && z.url().safeParse(value).success),
      'Enter a valid http(s) avatar URL.'
    ),
})

export type ProfileFormValues = z.infer<typeof profileFormSchema>

/**
 * Body for the native `authClient.updateUser` endpoint: an emptied avatar
 * clears the stored image, and an empty name is rejected by the schema above.
 */
export function profileUpdateInput(values: ProfileFormValues) {
  const name = values.name.trim()
  const image = values.image.trim()
  return { name, image: image === '' ? null : image }
}
