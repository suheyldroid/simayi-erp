import { z } from 'zod'

const user = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  role: z.string(),
  isActive: z.boolean(),
  banned: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const UsersModel = {
  user,
  listResponse: z.object({
    users: z.array(user),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  }),
  profileBody: z.object({ name: z.string(), image: z.string().nullable() }),
}

export type User = z.infer<typeof UsersModel.user>
export type UserProfileInput = z.infer<typeof UsersModel.profileBody>
