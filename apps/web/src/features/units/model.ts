import { z } from 'zod'
import { resourceUuid } from '@/lib/resource-uuid'

const pageSize = z.number().int().positive()
const paging = {
  total: z.number().int().nonnegative(),
  limit: pageSize,
  offset: z.number().int().nonnegative(),
}

export const unit = z.object({
  uuid: resourceUuid,
  name: z.string(),
  code: z.string(),
  active: z.boolean(),
  version: z.number().int().nonnegative(),
})

const list = <T extends z.ZodType>(entry: T) =>
  z.object({ items: z.array(entry), ...paging })

const name = z.string().trim().min(1, 'Enter a unit name.').max(100)
const code = z.string().trim().min(1, 'Enter a unit code.').max(20)

export const UnitsModel = {
  unit,
  units: list(unit),
  success: z.object({ success: z.literal(true) }),
  unitInput: z.object({
    name,
    code,
    active: z.boolean().optional(),
  }),
  unitUpdate: z.object({
    version: z.number().int().nonnegative(),
    name: name.optional(),
    code: code.optional(),
    active: z.boolean().optional(),
  }),
}

export type Unit = z.infer<typeof unit>
export type UnitInput = z.infer<typeof UnitsModel.unitInput>
export type UnitUpdateInput = z.infer<typeof UnitsModel.unitUpdate>
