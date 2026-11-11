import type { Supplier } from './model'

export function formatSupplierAddress(supplier: Supplier) {
  return [
    supplier.line1,
    supplier.line2,
    [supplier.postalCode, supplier.postalCity].filter(Boolean).join(' '),
    supplier.province,
    supplier.country,
  ]
    .filter((value) => value.trim() !== '')
    .join(', ')
}
