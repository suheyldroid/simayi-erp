import { z } from 'zod'
import { resourceUuid } from '@/lib/resource-uuid'

const branch = z
  .object({
    uuid: resourceUuid,
    name: z.string(),
    description: z
      .string()
      .nullish()
      .transform((value) => value ?? null),
    active: z.boolean(),
    version: z.number().int().nonnegative(),
    createdAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
  })
  .transform((value) => ({
    ...value,
    createdAt: value.createdAt ?? null,
    updatedAt: value.updatedAt ?? null,
  }))

/** One page of the company branch directory. */
const branchList = z.object({
  items: z.array(branch),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
})

export const BranchesModel = {
  branch,
  branches: branchList,
  input: z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(250),
  }),
}

export type Branch = z.infer<typeof branch>
export type BranchInput = z.infer<typeof BranchesModel.input>
