import type { StockItem } from '../generated/client/client';

export function stockItemDto(item: Pick<StockItem, 'id' | 'quantity' | 'version' | 'expiryDate'>) {
  return {
    id: item.id,
    quantity: item.quantity.toString(),
    version: item.version,
    expiryDate: item.expiryDate?.toISOString().slice(0, 10) ?? null,
  };
}

export function referenceIndexDto(value: bigint): string {
  return value.toString();
}

// Parse quantity inputs using Prisma.Decimal from a validated decimal string.
// Do not Number(...) amounts/reference indexes to make JSON serialization work.
