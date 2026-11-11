import { z } from 'zod'
import { resourceUuid } from '@/lib/resource-uuid'

const pageSize = z.number().int().positive()
const paging = {
  total: z.number().int().nonnegative(),
  limit: pageSize,
  offset: z.number().int().nonnegative(),
}
const supplierFields = {
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  phone: z.string().max(50),
  contact: z.string().max(100),
  contactPhone: z.string().max(100),
  contactRole: z.string().max(100),
  image: z.string().max(100).nullable(),
  active: z.boolean(),
  taxId: z.string().max(50),
  line1: z.string().max(50),
  line2: z.string().max(50),
  postalCode: z.string().max(10),
  postalCity: z.string().max(50),
  province: z.string().max(50),
  country: z.string().max(50),
  shippingNotes: z.string().max(100),
  internalShippingNotes: z.string().max(100),
  addressLink: z.string().max(2000),
}
const supplier = z.object({ uuid: resourceUuid, ...supplierFields })

export const SupplierModel = {
  supplier,
  body: z.object(supplierFields),
  suppliers: z.object({ items: z.array(supplier), ...paging }),
  success: z.object({ success: z.literal(true) }),
}
export type Supplier = z.infer<typeof supplier>
export type SupplierInput = z.infer<typeof SupplierModel.body>
