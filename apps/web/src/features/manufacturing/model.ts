import { z } from 'zod'

const id = z.number().int().positive()
const location = z.object({
  id,
  name: z.string(),
  pathstring: z.string(),
})
const part = z.object({
  id,
  name: z.string(),
  ipn: z.string().nullable(),
  trackable: z.boolean(),
})
const status = z.union([
  z.literal(10),
  z.literal(20),
  z.literal(25),
  z.literal(30),
  z.literal(40),
])

export const ManufacturingModel = {
  build: z.object({
    id,
    reference: z.string(),
    referenceInt: z.string(),
    title: z.string(),
    partId: id,
    part,
    parentId: id.nullable(),
    parent: z.object({ id, reference: z.string() }).nullable(),
    takeFromId: id.nullable(),
    takeFrom: location.nullable(),
    destinationId: id.nullable(),
    destination: location.nullable(),
    quantity: z.number().int().positive(),
    completed: z.number().int().nonnegative(),
    status,
    batch: z.string().nullable(),
    creationDate: z.string(),
    startDate: z.string().nullable(),
    targetDate: z.string().nullable(),
    completionDate: z.string().nullable(),
    issuedById: z.string().nullable(),
    completedById: z.string().nullable(),
    responsibleId: id.nullable(),
    projectCodeId: id.nullable(),
    projectCode: z.object({ id, code: z.string() }).nullable(),
    link: z.string(),
    priority: z.number().int().nonnegative(),
    external: z.boolean(),
    barcodeData: z.string(),
    barcodeHash: z.string(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    version: z.number().int().nonnegative(),
  }),
  line: z.object({
    id,
    buildId: id,
    bomItemId: id,
    quantity: z.string(),
    consumed: z.string(),
    allocated: z.string(),
    optional: z.boolean(),
    consumable: z.boolean(),
    allowVariants: z.boolean(),
    trackable: z.boolean(),
    reference: z.string(),
    part,
    substitutes: z.array(z.object({ id, name: z.string() })),
  }),
  allocation: z.object({
    id,
    buildLineId: id.nullable(),
    stockItemId: id,
    quantity: z.string(),
    installIntoId: id.nullable(),
    stockItem: z.object({
      id,
      quantity: z.string(),
      serial: z.string().nullable(),
      batch: z.string().nullable(),
      partId: id,
      partName: z.string(),
    }),
    output: z
      .object({
        id,
        serial: z.string().nullable(),
        quantity: z.string(),
      })
      .nullable(),
  }),
  success: z.object({ success: z.literal(true) }),
}

const list = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })

export const manufacturingLists = {
  builds: list(ManufacturingModel.build),
  lines: list(ManufacturingModel.line),
  allocations: list(ManufacturingModel.allocation),
}

export type BuildOrder = z.infer<typeof ManufacturingModel.build>
export type BuildLine = z.infer<typeof ManufacturingModel.line>
export type BuildAllocation = z.infer<typeof ManufacturingModel.allocation>
