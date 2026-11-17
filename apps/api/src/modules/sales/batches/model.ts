import { t, type UnwrapSchema } from "elysia";
import type { Prisma } from "../../../../prisma/generated/prisma/client";
import { SalesBatchPlain } from "../../../../prisma/generated/typebox/SalesBatch";
import { pageQuery, resourceParams, resourceUuid } from "@/lib/dto";

export const salesBatchStatus = {
  draft: 10,
  processed: 20,
} as const;

const day = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
const column = t.String({ pattern: "^[A-Z]{1,3}$", maxLength: 3 });
const nullableColumn = t.Nullable(column);

export const batchSummarySelect = {
  uuid: true,
  reference: true,
  referenceInt: true,
  businessDate: true,
  status: true,
  sourceFileName: true,
  sourceFileSize: true,
  rowCount: true,
  quantityTotal: true,
  channelCount: true,
  processedAt: true,
  createdAt: true,
  createdById: true,
  createdByName: true,
  branch: { select: { uuid: true, name: true } },
  channels: {
    select: { channel: { select: { uuid: true, name: true } } },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.SalesBatchSelect;

export const batchDetailSelect = {
  ...batchSummarySelect,
  sheetNames: true,
  sheetName: true,
  headerRow: true,
  channelColumn: true,
  productColumn: true,
  quantityColumn: true,
  productCodeColumn: true,
  excludedRows: true,
  builds: {
    select: {
      uuid: true,
      reference: true,
      recipeName: true,
      quantity: true,
      sourceRow: true,
      channel: { select: { uuid: true, name: true } },
    },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.SalesBatchSelect;

export const websiteSelect = {
  uuid: true,
  sourceFileName: true,
  organizationId: true,
} satisfies Prisma.SalesBatchSelect;

export type BatchSummaryRecord = Prisma.SalesBatchGetPayload<{
  select: typeof batchSummarySelect;
}>;
export type BatchDetailRecord = Prisma.SalesBatchGetPayload<{
  select: typeof batchDetailSelect;
}>;

const batchSale = t.Object(
  {
    uuid: resourceUuid,
    reference: t.String({ maxLength: 64 }),
    recipeName: t.String({ maxLength: 100 }),
    quantity: t.Integer({ minimum: 1 }),
    sourceRow: t.Nullable(t.Integer({ minimum: 1 })),
    channel: t.Nullable(
      t.Object(
        { uuid: resourceUuid, name: t.String({ maxLength: 100 }) },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

const branch = t.Object(
  { uuid: resourceUuid, name: t.String({ maxLength: 100 }) },
  { additionalProperties: false },
);

const summary = t.Object(
  {
    uuid: resourceUuid,
    reference: SalesBatchPlain.properties.reference,
    referenceInt: t.String(),
    businessDate: day,
    status: { ...SalesBatchPlain.properties.status, minimum: 0 },
    sourceFileName: SalesBatchPlain.properties.sourceFileName,
    sourceFileSize: {
      ...SalesBatchPlain.properties.sourceFileSize,
      minimum: 0,
    },
    rowCount: { ...SalesBatchPlain.properties.rowCount, minimum: 0 },
    quantityTotal: { ...SalesBatchPlain.properties.quantityTotal, minimum: 0 },
    channelCount: { ...SalesBatchPlain.properties.channelCount, minimum: 0 },
    processedAt: SalesBatchPlain.properties.processedAt,
    createdAt: SalesBatchPlain.properties.createdAt,
    createdById: t.Nullable(t.String()),
    createdByName: SalesBatchPlain.properties.createdByName,
    branch,
    channels: t.Array(
      t.Object(
        { uuid: resourceUuid, name: t.String({ maxLength: 100 }) },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

const detail = t.Object(
  {
    ...summary.properties,
    sheetNames: t.Array(t.String({ maxLength: 200 })),
    sheetName: t.Nullable(t.String({ maxLength: 200 })),
    headerRow: t.Nullable(t.Integer({ minimum: 1 })),
    channelColumn: nullableColumn,
    productColumn: nullableColumn,
    quantityColumn: nullableColumn,
    productCodeColumn: nullableColumn,
    excludedRows: t.Array(t.Integer({ minimum: 1 })),
    sales: t.Array(batchSale),
  },
  { additionalProperties: false },
);

const issue = t.Object(
  {
    code: t.String({ maxLength: 100 }),
    message: t.String({ maxLength: 500 }),
    blocking: t.Boolean(),
  },
  { additionalProperties: false },
);

const gridRow = t.Object(
  {
    row: t.Integer({ minimum: 1 }),
    cells: t.Array(t.String({ maxLength: 500 })),
  },
  { additionalProperties: false },
);

const previewRow = t.Object(
  {
    row: t.Integer({ minimum: 1 }),
    excluded: t.Boolean(),
    included: t.Boolean(),
    cells: t.Array(t.String({ maxLength: 500 })),
    channelValue: t.String({ maxLength: 200 }),
    productValue: t.String({ maxLength: 200 }),
    productCode: t.String({ maxLength: 100 }),
    productKey: t.Nullable(t.String({ maxLength: 250 })),
    quantityRaw: t.String({ maxLength: 100 }),
    quantity: t.Nullable(t.Integer({ minimum: 1 })),
    channelUuid: t.Nullable(resourceUuid),
    channelName: t.Nullable(t.String({ maxLength: 100 })),
    recipeUuid: t.Nullable(resourceUuid),
    recipeName: t.Nullable(t.String({ maxLength: 100 })),
    unitPrice: t.Nullable(t.String()),
    lineTotal: t.Nullable(t.String()),
    issues: t.Array(issue),
  },
  { additionalProperties: false },
);

const previewChannel = t.Object(
  {
    sourceValue: t.String({ maxLength: 200 }),
    channelUuid: t.Nullable(resourceUuid),
    channelName: t.Nullable(t.String({ maxLength: 100 })),
    rows: t.Integer({ minimum: 0 }),
    quantity: t.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

const previewProduct = t.Object(
  {
    productKey: t.String({ maxLength: 250 }),
    label: t.String({ maxLength: 200 }),
    sourceCode: t.Nullable(t.String({ maxLength: 100 })),
    sourceText: t.Nullable(t.String({ maxLength: 200 })),
    recipeUuid: t.Nullable(resourceUuid),
    recipeName: t.Nullable(t.String({ maxLength: 100 })),
    rows: t.Integer({ minimum: 0 }),
    quantity: t.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

const requirement = t.Object(
  {
    itemUuid: resourceUuid,
    itemName: t.String({ maxLength: 100 }),
    itemUnits: t.String({ maxLength: 20 }),
    required: t.String(),
    available: t.String(),
    missing: t.String(),
  },
  { additionalProperties: false },
);

const modposReport = t.Object(
  {
    sheetName: t.String({ maxLength: 200 }),
    headerRow: t.Integer({ minimum: 1 }),
    productCodeColumn: column,
    productColumn: column,
    quantityColumn: column,
    dateFrom: t.Nullable(day),
    dateTo: t.Nullable(day),
    notes: t.Array(issue),
  },
  { additionalProperties: false },
);

const preview = t.Object(
  {
    configured: t.Boolean(),
    branch,
    sheetNames: t.Array(t.String({ maxLength: 200 })),
    sheetName: t.Nullable(t.String({ maxLength: 200 })),
    headerRow: t.Nullable(t.Integer({ minimum: 1 })),
    channelColumn: nullableColumn,
    productColumn: nullableColumn,
    quantityColumn: nullableColumn,
    productCodeColumn: nullableColumn,
    excludedRows: t.Array(t.Integer({ minimum: 1 })),
    modpos: t.Nullable(modposReport),
    currencyCode: t.Nullable(t.String({ pattern: "^[A-Z]{3}$" })),
    grid: t.Array(gridRow),
    gridTruncated: t.Boolean(),
    rows: t.Array(previewRow),
    rowsTruncated: t.Boolean(),
    cellsTruncated: t.Boolean(),
    emptyRowCount: t.Integer({ minimum: 0 }),
    channels: t.Array(previewChannel),
    products: t.Array(previewProduct),
    requirements: t.Array(requirement),
    includedRows: t.Integer({ minimum: 0 }),
    excludedRowsCount: t.Integer({ minimum: 0 }),
    saleQuantity: t.Integer({ minimum: 0 }),
    blockingIssueCount: t.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

const sheetConfig = t.Object(
  {
    sheetName: t.String({ maxLength: 200 }),
    headerRow: t.Integer({ minimum: 1, maximum: 1048576 }),
    /** Null only for a verified channel-less Modpos report. */
    channelColumn: nullableColumn,
    productColumn: column,
    quantityColumn: column,
    productCodeColumn: t.Optional(nullableColumn),
  },
  { additionalProperties: false },
);

const patch = t.Object(
  {
    businessDate: t.Optional(day),
    sheet: t.Optional(sheetConfig),
    excludedRows: t.Optional(
      t.Array(t.Integer({ minimum: 1 }), { maxItems: 5000 }),
    ),
    channelMappings: t.Optional(
      t.Array(
        t.Object(
          {
            sourceValue: t.String({ minLength: 1, maxLength: 200 }),
            channelUuid: t.Nullable(resourceUuid),
          },
          { additionalProperties: false },
        ),
        { maxItems: 200 },
      ),
    ),
    productMappings: t.Optional(
      t.Array(
        t.Object(
          {
            productKey: t.String({ minLength: 1, maxLength: 250 }),
            recipeUuid: t.Nullable(resourceUuid),
          },
          { additionalProperties: false },
        ),
        { maxItems: 2000 },
      ),
    ),
  },
  { additionalProperties: false },
);

export const SalesBatchesModel = {
  params: resourceParams,
  query: pageQuery,
  previewQuery: t.Object(
    {
      sheet: t.Optional(t.String({ maxLength: 200 })),
    },
    { additionalProperties: false },
  ),
  body: t.Object(
    {
      file: t.File({
        description:
          "Original .xlsx sales report, up to 10 MB. Only .xlsx is supported.",
      }),
    },
    { additionalProperties: false },
  ),
  summary,
  detail,
  branch,
  issue,
  gridRow,
  previewRow,
  previewChannel,
  previewProduct,
  requirement,
  preview,
  patch,
  list: t.Object({
    items: t.Array(summary),
    total: t.Integer({ minimum: 0 }),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
  success: t.Object({ success: t.Literal(true) }),
  downloadParams: t.Object(
    {
      uuid: resourceUuid,
    },
    { additionalProperties: false },
  ),
} as const;

export type SalesBatchesModel = {
  [K in keyof typeof SalesBatchesModel]: UnwrapSchema<
    (typeof SalesBatchesModel)[K]
  >;
};

export type BatchPreviewRow = SalesBatchesModel["previewRow"];
export type BatchPreview = SalesBatchesModel["preview"];
