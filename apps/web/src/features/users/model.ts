import { z } from 'zod'

const instant = z
  .union([z.iso.datetime(), z.date()])
  .transform((value) => (value instanceof Date ? value.toISOString() : value))

const user = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  role: z.string().nullable(),
  isActive: z.boolean(),
  banned: z.boolean().nullable(),
  banReason: z.string().nullable(),
  banExpires: instant.nullable(),
  isStaff: z.boolean(),
  isSuperuser: z.boolean(),
  createdAt: instant,
  updatedAt: instant,
})

// Native Better Auth admin rows may omit keys the raw /users response always
// returns; omitted keys stay omitted and nulls stay null, with no defaults.
const adminUser = user.partial({
  image: true,
  role: true,
  banReason: true,
  banExpires: true,
  isStaff: true,
  isSuperuser: true,
})

export const UsersModel = {
  user,
  adminUser,
  listResponse: z.object({
    users: z.array(user),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  }),
  profileBody: z.object({
    name: z.string().optional(),
    image: z.string().nullable().optional(),
  }),
}

export type User = z.infer<typeof UsersModel.adminUser>
export type UserProfileInput = z.infer<typeof UsersModel.profileBody>
