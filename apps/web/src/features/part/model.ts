import { z } from 'zod'

const id = z.number().int().positive()
const paging = {
  total: z.number().int().nonnegative(),
  limit: id,
  offset: z.number().int().nonnegative(),
}
const metadata = z.record(z.string(), z.unknown()).nullable()
const summary = z.object({
  id,
  name: z.string(),
  pathstring: z.string(),
})
const formId = z.preprocess((value) => {
  if (typeof value !== 'string' || value.trim() === '') return null
  return Number(value)
}, id.nullable())
const quantity = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,6})?$/)
const category = z.object({
  id,
  name: z.string(),
  description: z.string(),
  parentId: id.nullable(),
  pathstring: z.string(),
  defaultLocationId: id.nullable(),
  defaultLocation: summary.nullable(),
  structural: z.boolean(),
  defaultKeywords: z.string().nullable(),
  icon: z.string().nullable(),
  childCount: z.number().int().nonnegative(),
  partCount: z.number().int().nonnegative(),
  metadata,
})
const templateSummary = z.object({
  id,
  name: z.string(),
  units: z.string(),
  unique: z.number().int().min(0).max(2),
  checkbox: z.boolean(),
  choices: z.string(),
  enabled: z.boolean(),
})
const categoryParameter = z.object({
  id,
  categoryId: id,
  templateId: id,
  defaultValue: z.string(),
  metadata,
  template: templateSummary,
})
const template = z.object({
  id,
  name: z.string(),
  units: z.string(),
  description: z.string(),
  checkbox: z.boolean(),
  choices: z.string(),
  enabled: z.boolean(),
  unique: z.number().int().min(0).max(2),
  modelTypeId: id.nullable(),
  metadata,
})
const part = z.object({
  id,
  name: z.string(),
  description: z.string(),
  metadata,
  image: z.string().nullable(),
  barcodeData: z.string(),
  barcodeHash: z.string(),
  isTemplate: z.boolean(),
  variantOfId: id.nullable(),
  keywords: z.string().nullable(),
  categoryId: id.nullable(),
  category: summary.nullable(),
  ipn: z.string().nullable(),
  revision: z.string().nullable(),
  revisionOfId: id.nullable(),
  link: z.string().nullable(),
  defaultLocationId: id.nullable(),
  defaultLocation: summary.nullable(),
  defaultExpiry: z.number().int().nonnegative(),
  minimumStock: z.string(),
  maximumStock: z.string(),
  units: z.string(),
  assembly: z.boolean(),
  component: z.boolean(),
  trackable: z.boolean(),
  testable: z.boolean(),
  purchaseable: z.boolean(),
  salable: z.boolean(),
  active: z.boolean(),
  locked: z.boolean(),
  virtual: z.boolean(),
  consumable: z.boolean(),
  bomValidated: z.boolean(),
  responsibleOwnerId: id.nullable(),
  baseCost: z.string(),
  multiple: z.number().int().positive(),
  version: z.number().int().nonnegative(),
  creationDate: z.string().nullable(),
  creationUserId: z.string().nullable(),
  variantCount: z.number().int().nonnegative(),
  revisionCount: z.number().int().nonnegative(),
})
const parameterTemplate = z.object({
  id,
  name: z.string(),
  units: z.string(),
  checkbox: z.boolean(),
  choices: z.string(),
  unique: z.number().int().min(0).max(2),
})
const parameter = z.object({
  id,
  templateId: id,
  data: z.string(),
  dataNumeric: z.number().nullable(),
  note: z.string(),
  updated: z.string().nullable(),
  updatedById: z.string().nullable(),
  metadata,
  template: parameterTemplate,
  partVersion: z.number().int().nonnegative(),
})
const list = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), ...paging })
const blank = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().nullable()
)
const decimal5 = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,5})?$/)
const partBrief = z.object({
  id,
  name: z.string(),
  ipn: z.string().nullable(),
})
const bomSubstitute = z.object({
  id,
  partId: id,
  metadata,
  part: partBrief,
})
const bomLine = z.object({
  id,
  partId: id,
  subPartId: id,
  subPart: partBrief,
  rawAmount: z.string(),
  quantity: z.string(),
  optional: z.boolean(),
  consumable: z.boolean(),
  setupQuantity: z.string(),
  attrition: z.string(),
  roundingMultiple: z.string().nullable(),
  pieceCount: z.number().int().positive(),
  reference: z.string(),
  note: z.string(),
  checksum: z.string(),
  validated: z.boolean(),
  inherited: z.boolean(),
  allowVariants: z.boolean(),
  editable: z.boolean(),
  metadata,
  substitutes: z.array(bomSubstitute),
})
const bomStatus = {
  bomValidated: z.boolean(),
  bomChecksum: z.string(),
  bomCheckedById: z.string().nullable(),
  bomCheckedDate: z.string().nullable(),
}
const priceBreak = z.object({
  id,
  partId: id,
  quantity: z.string(),
  price: z.string().nullable(),
  priceCurrency: z.string().length(3),
  updated: z.string().nullable(),
})

export const PartModel = {
  category,
  categories: list(category),
  categoryParameter,
  categoryParameters: list(categoryParameter),
  template,
  templates: list(template),
  part,
  parts: list(part),
  parameter,
  parameters: list(parameter),
  success: z.object({ success: z.literal(true) }),
  removedParameter: z.object({
    success: z.literal(true),
    partVersion: z.number().int().nonnegative(),
  }),
  categoryInput: z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(250),
    parentId: formId.optional(),
    defaultLocationId: formId.optional(),
    structural: z.boolean(),
    defaultKeywords: blank.optional(),
    icon: blank.optional(),
  }),
  categoryParameterInput: z.object({
    templateId: id,
    defaultValue: z.string().max(500).optional(),
  }),
  templateInput: z.object({
    name: z.string().trim().min(1).max(100),
    units: z.string().max(25).optional(),
    description: z.string().max(250).optional(),
    checkbox: z.boolean().optional(),
    choices: z.string().max(5000).optional(),
    enabled: z.boolean().optional(),
    unique: z.number().int().min(0).max(2).optional(),
    modelTypeId: formId.optional(),
  }),
  partInput: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(250).optional(),
    image: blank.optional(),
    barcodeData: z.string().max(500).optional(),
    isTemplate: z.boolean().optional(),
    variantOfId: formId.optional(),
    keywords: blank.optional(),
    categoryId: formId.optional(),
    ipn: blank.optional(),
    revision: blank.optional(),
    revisionOfId: formId.optional(),
    link: blank.optional(),
    defaultLocationId: formId.optional(),
    defaultExpiry: z.number().int().nonnegative().optional(),
    minimumStock: quantity.optional(),
    maximumStock: quantity.optional(),
    units: z.string().max(20).nullable().optional(),
    assembly: z.boolean().optional(),
    component: z.boolean().optional(),
    trackable: z.boolean().optional(),
    testable: z.boolean().optional(),
    purchaseable: z.boolean().optional(),
    salable: z.boolean().optional(),
    active: z.boolean().optional(),
    locked: z.boolean().optional(),
    virtual: z.boolean().optional(),
    consumable: z.boolean().optional(),
    responsibleOwnerId: formId.optional(),
    baseCost: quantity.optional(),
    multiple: z.number().int().positive().optional(),
    version: z.number().int().nonnegative().optional(),
  }),
  parameterInput: z.object({
    templateId: id,
    data: z.string().trim().min(1).max(500),
    note: z.string().max(500).optional(),
    version: z.number().int().nonnegative(),
  }),
  bom: z.object({
    items: z.array(bomLine),
    ...paging,
    ...bomStatus,
    assembly: z.boolean(),
    locked: z.boolean(),
    isTemplate: z.boolean(),
  }),
  bomLine,
  bomSubstitute,
  bomValidation: z.object(bomStatus),
  bomInput: z.object({
    subPartId: id,
    rawAmount: decimal5,
    optional: z.boolean().optional(),
    consumable: z.boolean().optional(),
    inherited: z.boolean().optional(),
    allowVariants: z.boolean().optional(),
    setupQuantity: decimal5.optional(),
    attrition: z
      .string()
      .trim()
      .regex(/^\d+(?:\.\d{1,3})?$/)
      .optional(),
    roundingMultiple: decimal5.nullable().optional(),
    pieceCount: z.number().int().positive().optional(),
    reference: z.string().max(5000).optional(),
    note: z.string().max(500).optional(),
  }),
  substituteInput: z.object({ partId: id }),
  priceBreak,
  priceBreaks: list(priceBreak),
  priceInput: z.object({
    quantity: decimal5,
    price: z
      .string()
      .trim()
      .regex(/^\d+(?:\.\d{1,6})?$/)
      .nullable()
      .optional(),
    priceCurrency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  }),
}
export type Category = z.infer<typeof category>
export type CategoryParameter = z.infer<typeof categoryParameter>
export type ParameterTemplate = z.infer<typeof template>
export type Part = z.infer<typeof part>
export type PartParameter = z.infer<typeof parameter>
export type CategoryInput = z.infer<typeof PartModel.categoryInput>
export type CategoryParameterInput = z.infer<
  typeof PartModel.categoryParameterInput
>
export type TemplateInput = z.infer<typeof PartModel.templateInput>
export type PartInput = z.infer<typeof PartModel.partInput>
export type ParameterInput = z.infer<typeof PartModel.parameterInput>
export type BomLine = z.infer<typeof bomLine>
export type BomSubstitute = z.infer<typeof bomSubstitute>
export type BomInput = z.infer<typeof PartModel.bomInput>
export type PriceBreak = z.infer<typeof priceBreak>
export type PriceInput = z.infer<typeof PartModel.priceInput>
