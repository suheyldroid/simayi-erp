import { t, type UnwrapSchema } from "elysia";
import type {
  Prisma,
  PrismaClient,
} from "../../../prisma/generated/prisma/client";
import { MoneyMovementPlain } from "../../../prisma/generated/typebox/MoneyMovement";
import { pageQuery, resourceParams, resourceUuid } from "@/lib/dto";

export type Database = Prisma.TransactionClient | PrismaClient;

/**
 * Money movement entry kinds stored in `money_movement.entry_kind`. Reversal
 * rows carry their own kind and a unique reversal link, so an original row is
 * reversed at most once and net sums stay exact.
 */
export const moneyMovementKind = {
  income: 20,
  expense: 30,
  supplierPayment: 40,
  saleReceipt: 50,
  purchase: 60,
  reversal: 90,
} as const;

export type MoneyMovementKind =
  | "income"
  | "expense"
  | "supplier_payment"
  | "sale_receipt"
  | "purchase"
  | "reversal";

const kindNames: Record<number, MoneyMovementKind> = {
  [moneyMovementKind.income]: "income",
  [moneyMovementKind.expense]: "expense",
  [moneyMovementKind.supplierPayment]: "supplier_payment",
  [moneyMovementKind.saleReceipt]: "sale_receipt",
  [moneyMovementKind.purchase]: "purchase",
  [moneyMovementKind.reversal]: "reversal",
};

/** Every stored kind is known; an unknown value is a data defect, not a reversal. */
export function moneyMovementKindName(value: number): MoneyMovementKind {
  const name = kindNames[value];
  if (name === undefined)
    throw new Error(`Unknown money movement entry kind ${value}`);
  return name;
}

/**
 * Reservation lifecycle of the one purchase row per order. Every other kind is
 * posted: a reserved row only moves the cash it anticipates, never the balance.
 */
export const movementStatus = {
  onHold: 10,
  posted: 20,
  cancelled: 30,
} as const;

export type MovementStatus = "on_hold" | "posted" | "cancelled";

const statusNames: Record<number, MovementStatus> = {
  [movementStatus.onHold]: "on_hold",
  [movementStatus.posted]: "posted",
  [movementStatus.cancelled]: "cancelled",
};

/** Every stored status is known; an unknown value is a data defect. */
export function movementStatusName(value: number): MovementStatus {
  const name = statusNames[value];
  if (name === undefined)
    throw new Error(`Unknown money movement status ${value}`);
  return name;
}

/**
 * Rows read for one money movement. The reversal links keep the immutable
 * original and its single linked reversal visible without a stored `reversed`
 * flag.
 */
export const movementSelect = {
  id: true,
  uuid: true,
  entryKind: true,
  status: true,
  currencyCode: true,
  amount: true,
  occurredAt: true,
  note: true,
  createdAt: true,
  createdById: true,
  buildId: true,
  supplierId: true,
  purchaseOrderId: true,
  pricingIncomplete: true,
  pricingIssueCount: true,
  reversalOf: { select: { uuid: true } },
  reversal: { select: { uuid: true } },
  supplier: { select: { uuid: true, name: true } },
  build: {
    select: {
      uuid: true,
      reference: true,
      branch: { select: { uuid: true, name: true } },
    },
  },
  purchaseOrder: {
    select: {
      uuid: true,
      reference: true,
      branch: { select: { uuid: true, name: true } },
    },
  },
} satisfies Prisma.MoneyMovementSelect;

export type MovementRecord = Prisma.MoneyMovementGetPayload<{
  select: typeof movementSelect;
}>;

export const dayString = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
export const currencyCodeString = t.String({
  pattern: "^[A-Z]{3}$",
  minLength: 3,
});
// Exact decimal strings; Prismabox types Decimal as Number. A positive amount
// never carries a sign or a zero value, and at most 13 integer digits with 6
// fraction digits fit DECIMAL(19,6).
export const positiveMoney = t.String({
  pattern: "^(?!0+(?:\\.0+)?$)\\d{1,13}(?:\\.\\d{1,6})?$",
  maxLength: 20,
});
const note = {
  ...MoneyMovementPlain.properties.note,
  maxLength: 500,
};
const requestKey = t.String({
  minLength: 1,
  maxLength: 100,
  pattern: "\\S",
});

/** Money in one direction with an explicit calendar date. */
export const positiveMoneyBody = t.Object(
  {
    amount: positiveMoney,
    date: dayString,
    note: t.Optional(note),
    requestKey,
  },
  { additionalProperties: false },
);

/** Exact balance string: signed total of posted rows or the positive hold. */
const balance = t.String();

const movement = t.Object({
  uuid: resourceUuid,
  kind: t.Union([
    t.Literal("income"),
    t.Literal("expense"),
    t.Literal("supplier_payment"),
    t.Literal("sale_receipt"),
    t.Literal("purchase"),
    t.Literal("reversal"),
  ]),
  status: t.Union([
    t.Literal("on_hold"),
    t.Literal("posted"),
    t.Literal("cancelled"),
  ]),
  currencyCode: MoneyMovementPlain.properties.currencyCode,
  amount: t.String(),
  occurredAt: dayString,
  note,
  supplierUuid: t.Nullable(resourceUuid),
  supplierName: t.Nullable(t.String({ maxLength: 100 })),
  purchaseOrderUuid: t.Nullable(resourceUuid),
  purchaseOrderReference: t.Nullable(t.String({ maxLength: 64 })),
  pricingIncomplete: t.Boolean(),
  pricingIssueCount: t.Integer({ minimum: 0 }),
  saleUuid: t.Nullable(resourceUuid),
  saleReference: t.Nullable(t.String({ maxLength: 64 })),
  // Provenance of the linked document, never the current request context: a
  // sale receipt reports the branch of the sale, a purchase reports the order
  // origin (never a receipt destination), and manual money has no branch.
  branchUuid: t.Nullable(resourceUuid),
  branchName: t.Nullable(t.String({ maxLength: 100 })),
  reversalOfUuid: t.Nullable(resourceUuid),
  reversed: t.Boolean(),
  reversible: t.Boolean(),
  createdAt: MoneyMovementPlain.properties.createdAt,
  createdById: MoneyMovementPlain.properties.createdById,
});

export const FinanceModel = {
  params: resourceParams,
  query: pageQuery,
  positiveMoneyBody,
  summary: t.Object({
    configured: t.Boolean(),
    currencyCode: t.Nullable(currencyCodeString),
    balance,
    onHold: balance,
    availableBalance: balance,
    movementCount: t.Integer({ minimum: 0 }),
    pendingPricingCount: t.Integer({ minimum: 0 }),
  }),
  movement,
  list: t.Object({
    items: t.Array(movement),
    total: t.Integer(),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
} as const;
export type FinanceModel = {
  [K in keyof typeof FinanceModel]: UnwrapSchema<(typeof FinanceModel)[K]>;
};
