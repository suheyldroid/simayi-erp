import { z } from 'zod'

const id = z.number().int().positive()
const paging = {
  total: z.number().int().nonnegative(),
  limit: id,
  offset: z.number().int().nonnegative(),
}
const unitBody = z.object({
  name: z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/)
    .max(50),
  symbol: z.string().max(10),
  definition: z.string().trim().min(1).max(50),
})
const projectBody = z.object({
  code: z.string().trim().min(1).max(50),
  description: z.string().max(200),
  active: z.boolean(),
  responsibleId: id.nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
})
const statusBody = z.object({
  referenceStatus: z.string().min(1),
  logicalKey: id,
  key: id,
  name: z
    .string()
    .regex(/^[A-Z_][A-Z0-9_]*$/)
    .max(250),
  label: z.string().trim().min(1).max(250),
  color: z.enum([
    'primary',
    'secondary',
    'success',
    'warning',
    'danger',
    'info',
    'dark',
  ]),
  modelId: id,
})
const unit = unitBody.extend({ id })
const project = projectBody.extend({ id })
const status = statusBody.extend({ id, modelId: id.nullable() })
const modelType = z.object({ id, appLabel: z.string(), model: z.string() })
const setting = z.object({
  key: z.string(),
  value: z.string(),
  defaultValue: z.string(),
  type: z.enum(['string', 'boolean', 'integer', 'currency', 'reference']),
})
export const CommonModel = {
  unitBody,
  projectBody,
  statusBody,
  unit,
  project,
  status,
  modelType,
  setting,
  settings: z.array(setting),
  units: z.object({
    items: z.array(unit),
    ...paging,
    builtins: z.array(
      z.object({ name: z.string(), dimension: z.string(), factor: z.string() })
    ),
  }),
  projects: z.object({ items: z.array(project), ...paging }),
  statuses: z.object({ items: z.array(status), ...paging }),
  modelTypes: z.object({ items: z.array(modelType), ...paging }),
  catalog: z.array(
    z.object({
      referenceStatus: z.string(),
      appLabel: z.string(),
      model: z.string(),
      values: z.record(z.string(), z.number().int()),
    })
  ),
  conversion: z.object({ amount: z.string() }),
  success: z.object({ success: z.literal(true) }),
}
export type Unit = z.infer<typeof unit>
export type Project = z.infer<typeof project>
export type CustomStatus = z.infer<typeof status>
export type Setting = z.infer<typeof setting>
export type ModelType = z.infer<typeof modelType>
export type UnitInput = z.infer<typeof unitBody>
export type ProjectInput = z.infer<typeof projectBody>
export type StatusInput = z.infer<typeof statusBody>
