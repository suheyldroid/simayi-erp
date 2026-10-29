// Source codes are integers so custom states remain extensible.
export const BuildStatus = {
  "PENDING": 10,
  "PRODUCTION": 20,
  "ON_HOLD": 25,
  "CANCELLED": 30,
  "COMPLETE": 40
} as const;

export const DataImportStatusCode = {
  "INITIAL": 0,
  "MAPPING": 10,
  "IMPORTING": 20,
  "PROCESSING": 30,
  "COMPLETE": 40
} as const;

export const PurchaseOrderStatus = {
  "PENDING": 10,
  "PLACED": 20,
  "ON_HOLD": 25,
  "COMPLETE": 30,
  "CANCELLED": 40,
  "LOST": 50,
  "RETURNED": 60
} as const;

export const SalesOrderStatus = {
  "PENDING": 10,
  "IN_PROGRESS": 15,
  "SHIPPED": 20,
  "ON_HOLD": 25,
  "COMPLETE": 30,
  "CANCELLED": 40,
  "LOST": 50,
  "RETURNED": 60
} as const;

export const ReturnOrderStatus = {
  "PENDING": 10,
  "IN_PROGRESS": 20,
  "ON_HOLD": 25,
  "COMPLETE": 30,
  "CANCELLED": 40
} as const;

export const ReturnOrderLineStatus = {
  "PENDING": 10,
  "RETURN": 20,
  "REPAIR": 30,
  "REPLACE": 40,
  "REFUND": 50,
  "REJECT": 60
} as const;

export const TransferOrderStatus = {
  "PENDING": 10,
  "ISSUED": 20,
  "ON_HOLD": 25,
  "COMPLETE": 30,
  "CANCELLED": 40
} as const;

export const StockStatus = {
  "OK": 10,
  "ATTENTION": 50,
  "DAMAGED": 55,
  "DESTROYED": 60,
  "REJECTED": 65,
  "LOST": 70,
  "QUARANTINED": 75,
  "RETURNED": 85
} as const;

export const StockHistoryCode = {
  "LEGACY": 0,
  "CREATED": 1,
  "EDITED": 5,
  "ASSIGNED_SERIAL": 6,
  "STOCK_COUNT": 10,
  "STOCK_ADD": 11,
  "STOCK_REMOVE": 12,
  "STOCK_SERIALIZED": 13,
  "RETURNED_TO_STOCK": 15,
  "STOCK_MOVE": 20,
  "STOCK_UPDATE": 25,
  "INSTALLED_INTO_ASSEMBLY": 30,
  "REMOVED_FROM_ASSEMBLY": 31,
  "INSTALLED_CHILD_ITEM": 35,
  "REMOVED_CHILD_ITEM": 36,
  "SPLIT_FROM_PARENT": 40,
  "SPLIT_CHILD_ITEM": 42,
  "MERGED_STOCK_ITEMS": 45,
  "DISASSEMBLED": 46,
  "CREATED_FROM_DISASSEMBLY": 47,
  "CONVERTED_TO_VARIANT": 48,
  "BUILD_OUTPUT_CREATED": 50,
  "BUILD_OUTPUT_COMPLETED": 55,
  "BUILD_OUTPUT_REJECTED": 56,
  "BUILD_CONSUMED": 57,
  "SHIPPED_AGAINST_SALES_ORDER": 60,
  "RECEIVED_AGAINST_PURCHASE_ORDER": 70,
  "RETURNED_AGAINST_RETURN_ORDER": 80,
  "SENT_TO_CUSTOMER": 100,
  "RETURNED_FROM_CUSTOMER": 105
} as const;
