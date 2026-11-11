import { z } from 'zod'
import { resourceUuid } from '@/lib/resource-uuid'

const pageSize = z.number().int().positive()
const paging = {
  total: z.number().int().nonnegative(),
  limit: pageSize,
  offset: z.number().int().nonnegative(),
}
const formUuid = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  resourceUuid.nullable()
)
const category = z.object({
  uuid: resourceUuid,
  name: z.string(),
  description: z.string(),
  parentUuid: resourceUuid.nullable(),
  pathstring: z.string(),
  structural: z.boolean(),
  childCount: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
})
const list = <T extends z.ZodType>(entry: T) =>
  z.object({ items: z.array(entry), ...paging })

export const ItemCategoriesModel = {
  category,
  categories: list(category),
  success: z.object({ success: z.literal(true) }),
  categoryInput: z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(250),
    parentUuid: formUuid.optional(),
    structural: z.boolean(),
  }),
}
export type Category = z.infer<typeof category>
export type CategoryInput = z.infer<typeof ItemCategoriesModel.categoryInput>
