import { t, type UnwrapSchema } from "elysia";
import type { Prisma } from "../../../../prisma/generated/prisma/client";
import { PosDevicePlain } from "../../../../prisma/generated/typebox/PosDevice";
import { PosDeviceZReportPlain } from "../../../../prisma/generated/typebox/PosDeviceZReport";
import { SalesBatchPlain } from "../../../../prisma/generated/typebox/SalesBatch";
import { pageQuery, resourceUuid } from "@/lib/dto";
import { posBranch } from "../model";

const day = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" });

// Format `date-time` already requires a real calendar date, a real time and an
// explicit timezone; the pattern only documents the accepted shape.
const closedAt = {
  ...PosDeviceZReportPlain.properties.closedAt,
  pattern:
    "^\\d{4}-\\d{2}-\\d{2}[Tt]\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,9})?(?:[Zz]|[+-]\\d{2}:\\d{2})$",
  maxLength: 40,
};

const reportNumber = {
  ...PosDeviceZReportPlain.properties.reportNumber,
  minLength: 1,
  maxLength: 100,
  pattern: "\\S",
};

/**
 * Nonnegative exact amount that fits `DECIMAL(19,6)`: at most 13 integer and 6
 * fraction digits, never a sign, exponent or JavaScript number.
 */
const totalAmount = t.String({
  pattern: "^\\d{1,13}(?:\\.\\d{1,6})?$",
  maxLength: 20,
});

const note = {
  ...PosDeviceZReportPlain.properties.note,
  maxLength: 500,
};

const salesBatchUuid = t.Nullable(resourceUuid);

const version = {
  ...PosDeviceZReportPlain.properties.version,
  minimum: 0,
};

/**
 * Presentation columns. The internal ids and the report device/batch integers
 * never leave the service; both relations are projected by public UUID.
 */
export const zReportColumns = {
  uuid: true,
  reportNumber: true,
  businessDate: true,
  closedAt: true,
  totalAmount: true,
  currencyCode: true,
  note: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  posDevice: {
    select: {
      uuid: true,
      name: true,
      branch: { select: { uuid: true, name: true, active: true } },
    },
  },
  salesBatch: {
    select: {
      uuid: true,
      reference: true,
      businessDate: true,
      status: true,
    },
  },
} satisfies Prisma.PosDeviceZReportSelect;

export type ZReportRecord = Prisma.PosDeviceZReportGetPayload<{
  select: typeof zReportColumns;
}>;

const report = t.Object(
  {
    uuid: resourceUuid,
    reportNumber,
    businessDate: day,
    closedAt,
    totalAmount: t.String(),
    currencyCode: PosDeviceZReportPlain.properties.currencyCode,
    note,
    version,
    createdAt: PosDeviceZReportPlain.properties.createdAt,
    updatedAt: PosDeviceZReportPlain.properties.updatedAt,
    posDevice: t.Object(
      { uuid: resourceUuid, name: PosDevicePlain.properties.name },
      { additionalProperties: false },
    ),
    // Derived from the immutable device link: the report can never claim a
    // branch other than the device that produced it.
    branch: posBranch,
    salesBatch: t.Nullable(
      t.Object(
        {
          uuid: resourceUuid,
          reference: SalesBatchPlain.properties.reference,
          businessDate: day,
          status: SalesBatchPlain.properties.status,
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

const body = t.Object(
  {
    reportNumber,
    businessDate: day,
    closedAt,
    totalAmount,
    note,
    salesBatchUuid,
  },
  { additionalProperties: false },
);

export const PosDeviceZReportsModel = {
  createParams: t.Object(
    { deviceUuid: resourceUuid },
    { additionalProperties: false },
  ),
  params: t.Object(
    { deviceUuid: resourceUuid, uuid: resourceUuid },
    { additionalProperties: false },
  ),
  query: t.Object({
    ...pageQuery.properties,
    posDeviceUuid: t.Optional(resourceUuid),
    salesBatchUuid: t.Optional(resourceUuid),
  }),
  body,
  patch: t.Object(
    {
      reportNumber,
      businessDate: day,
      closedAt,
      totalAmount,
      note,
      salesBatchUuid,
      version,
    },
    { additionalProperties: false },
  ),
  report,
  list: t.Object({
    items: t.Array(report),
    total: t.Integer({ minimum: 0 }),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
} as const;
export type PosDeviceZReportsModel = {
  [K in keyof typeof PosDeviceZReportsModel]: UnwrapSchema<
    (typeof PosDeviceZReportsModel)[K]
  >;
};
