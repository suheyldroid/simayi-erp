import { t, type UnwrapSchema } from "elysia";
import type { Prisma } from "../../../../prisma/generated/prisma/client";
import { SupplierLedgerEntryPlain } from "../../../../prisma/generated/typebox/SupplierLedgerEntry";
import { pageQuery, resourceUuid } from "@/lib/dto";
import { currencyCodeString, dayString, positiveMoneyBody } from "../model";

/**
 * Supplier ledger entry kinds. Positive amounts are debt we owe the supplier;
 * negative amounts are a credit or advance. Reversals carry their own kind and
 * a unique reversal link, so an entry is reversed at most once.
 */
export const supplierLedgerKind = {
  purchase: 20,
  payment: 30,
  reversal: 90,
} as const;

export type SupplierLedgerKind = "purchase" | "payment" | "reversal";

const kindNames: Record<number, SupplierLedgerKind> = {
  [supplierLedgerKind.purchase]: "purchase",
  [supplierLedgerKind.payment]: "payment",
  [supplierLedgerKind.reversal]: "reversal",
};

/** Every stored kind is known; an unknown value is a data defect, not a reversal. */
export function supplierLedgerKindName(value: number): SupplierLedgerKind {
  const name = kindNames[value];
  if (name === undefined)
    throw new Error(`Unknown supplier ledger entry kind ${value}`);
  return name;
}

export const supplierEntrySelect = {
  id: true,
  uuid: true,
  supplierId: true,
  entryKind: true,
  currencyCode: true,
  amount: true,
  occurredAt: true,
  note: true,
  createdAt: true,
  createdById: true,
  purchaseOrder: {
    select: {
      uuid: true,
      reference: true,
      branch: { select: { uuid: true, name: true } },
    },
  },
  moneyMovement: { select: { uuid: true } },
  reversalOf: { select: { uuid: true } },
  reversal: { select: { uuid: true } },
} satisfies Prisma.SupplierLedgerEntrySelect;

export type SupplierEntryRecord = Prisma.SupplierLedgerEntryGetPayload<{
  select: typeof supplierEntrySelect;
}>;

const entry = t.Object({
  uuid: resourceUuid,
  kind: t.Union([
    t.Literal("purchase"),
    t.Literal("payment"),
    t.Literal("reversal"),
  ]),
  currencyCode: SupplierLedgerEntryPlain.properties.currencyCode,
  amount: t.String(),
  occurredAt: dayString,
  note: { ...SupplierLedgerEntryPlain.properties.note, maxLength: 500 },
  purchaseOrderUuid: t.Nullable(resourceUuid),
  purchaseOrderReference: t.Nullable(t.String({ maxLength: 64 })),
  // Origin branch of the linked purchase order; null for company-level entries.
  branchUuid: t.Nullable(resourceUuid),
  branchName: t.Nullable(t.String({ maxLength: 100 })),
  moneyMovementUuid: t.Nullable(resourceUuid),
  reversalOfUuid: t.Nullable(resourceUuid),
  reversed: t.Boolean(),
  createdAt: SupplierLedgerEntryPlain.properties.createdAt,
  createdById: SupplierLedgerEntryPlain.properties.createdById,
});

export const SupplierLedgerModel = {
  params: t.Object({ uuid: resourceUuid }),
  query: pageQuery,
  positiveMoneyBody,
  entry,
  ledger: t.Object({
    configured: t.Boolean(),
    currencyCode: t.Nullable(currencyCodeString),
    outstanding: t.String(),
    items: t.Array(entry),
    total: t.Integer(),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
} as const;
export type SupplierLedgerModel = {
  [K in keyof typeof SupplierLedgerModel]: UnwrapSchema<
    (typeof SupplierLedgerModel)[K]
  >;
};
