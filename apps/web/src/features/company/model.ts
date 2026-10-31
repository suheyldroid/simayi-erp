import { z } from 'zod'
import {
  hasPermission,
  type EffectivePermissions,
  type PermissionAction,
} from '@/features/users/access-model'

const id = z.number().int().positive()
const paging = {
  total: z.number().int().nonnegative(),
  limit: id,
  offset: z.number().int().nonnegative(),
}
const metadata = z.record(z.string(), z.unknown()).nullable()
const currency = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .optional()
const companyFields = {
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  website: z.string().max(2000),
  phone: z.string().max(50),
  email: z.string().max(254).nullable(),
  contact: z.string().max(100),
  link: z.string().max(2000),
  image: z.string().max(100).nullable(),
  active: z.boolean(),
  isCustomer: z.boolean(),
  isSupplier: z.boolean(),
  isManufacturer: z.boolean(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  taxId: z.string().max(50),
  metadata,
}
const company = z.object({ id, ...companyFields })
const contactFields = {
  name: z.string().trim().min(1).max(100),
  phone: z.string().max(100),
  email: z.string().max(254),
  role: z.string().max(100),
  metadata,
}
const contact = z.object({ id, companyId: id, ...contactFields })
const addressFields = {
  title: z.string().trim().min(1).max(100),
  primary: z.boolean(),
  line1: z.string().max(50),
  line2: z.string().max(50),
  postalCode: z.string().max(10),
  postalCity: z.string().max(50),
  province: z.string().max(50),
  country: z.string().max(50),
  shippingNotes: z.string().max(100),
  internalShippingNotes: z.string().max(100),
  link: z.string().max(2000),
}
const address = z.object({ id, companyId: id, ...addressFields })

export const CompanyModel = {
  company,
  contact,
  address,
  body: z.object({
    ...companyFields,
    currency,
    metadata: metadata.optional(),
  }),
  contactBody: z.object({
    ...contactFields,
    metadata: metadata.optional(),
  }),
  addressBody: z.object(addressFields),
  companies: z.object({ items: z.array(company), ...paging }),
  contacts: z.object({ items: z.array(contact), ...paging }),
  addresses: z.object({ items: z.array(address), ...paging }),
  success: z.object({ success: z.literal(true) }),
}
export type Company = z.infer<typeof company>
export type Contact = z.infer<typeof contact>
export type Address = z.infer<typeof address>
export type CompanyInput = z.infer<typeof CompanyModel.body>
export type ContactInput = z.infer<typeof CompanyModel.contactBody>
export type AddressInput = z.infer<typeof CompanyModel.addressBody>
export type CompanyRoles = Pick<
  Company,
  'isCustomer' | 'isSupplier' | 'isManufacturer'
>
export type CompanyFilter = 'all' | 'customers' | 'suppliers' | 'manufacturers'

export function companyScopes(company: CompanyRoles) {
  const scopes: Array<'sales_order' | 'purchase_order'> = []
  if (company.isCustomer) scopes.push('sales_order')
  if (company.isSupplier || company.isManufacturer)
    scopes.push('purchase_order')
  return scopes
}

export function canCompany(
  effective: EffectivePermissions | undefined,
  company: CompanyRoles,
  action: PermissionAction
) {
  const scopes = companyScopes(company)
  if (!scopes.length) return false
  if (action === 'view')
    return scopes.some((scope) => hasPermission(effective, scope, action))
  return scopes.every((scope) => hasPermission(effective, scope, action))
}
