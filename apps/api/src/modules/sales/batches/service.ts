import { Prisma } from "../../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import type { TenantActor } from "@/lib/tenant";
import { CatalogService } from "@/lib/catalog";
import { CurrencyCatalog } from "@/lib/currencies";
import { Decimal } from "@/lib/decimal";
import { FinanceService } from "../../finance/service";
import { ItemStockService } from "../../items/stock/service";
import { BranchesService } from "../../branches/service";
import { OrderService } from "../../order/service";
import { RecipeService } from "../../recipes/service";
import type { EffectiveRecipe } from "../../recipes/model";
import { SystemPreferencesService } from "../../system-preferences/service";
import { SalesService } from "../service";
import type { IngredientPlan } from "../model";
import { SalesBatchesFormatter } from "./formatter";
import {
  batchDetailSelect,
  batchSummarySelect,
  salesBatchStatus,
  websiteSelect,
  type BatchDetailRecord,
  type SalesBatchesModel,
} from "./model";
import { MediaFilesService } from "../../media/service";
import {
  assertWorkbookFile,
  cellAt,
  cellText,
  columnLetter,
  lastRowNumber,
  parseQuantity,
  maximumWorkbookColumns,
  maximumWorkbookRows,
  readWorkbook,
  readWorkbookSheet,
  usedColumnCount,
  validColumn,
  workbookMaxBytes,
  detectModposReport,
  type ModposDateIssue,
  type ModposReport,
  type WorkbookRow,
} from "./workbook";

type BatchConfig = {
  organizationId: string;
  branchId: number;
  id: number;
  sheetNames: string[];
  sheetName: string | null;
  headerRow: number | null;
  channelColumn: string | null;
  productColumn: string | null;
  quantityColumn: string | null;
  productCodeColumn: string | null;
  excludedRows: number[];
};

type RowIssue = { code: string; message: string; blocking: boolean };

type AnalysisRow = {
  row: number;
  excluded: boolean;
  included: boolean;
  cells: string[];
  channelValue: string;
  productValue: string;
  productCode: string;
  productKey: string | null;
  quantityRaw: string;
  quantity: number | null;
  channelId: number | null;
  channelUuid: string | null;
  channelName: string | null;
  recipeUuid: string | null;
  recipeName: string | null;
  unitPrice: string | null;
  lineTotal: string | null;
  issues: RowIssue[];
  recipe: EffectiveRecipe | null;
  requirements: IngredientPlan[];
};

type Analysis = {
  configured: boolean;
  sheetNames: string[];
  sheetName: string | null;
  headerRow: number | null;
  channelColumn: string | null;
  productColumn: string | null;
  quantityColumn: string | null;
  productCodeColumn: string | null;
  excludedRows: number[];
  modpos: SalesBatchesModel["preview"]["modpos"];
  currencyCode: string | null;
  grid: { row: number; cells: string[] }[];
  gridTruncated: boolean;
  cellsTruncated: boolean;
  rows: AnalysisRow[];
  allRows: AnalysisRow[];
  rowsTruncated: boolean;
  emptyRowCount: number;
  channels: SalesBatchesModel["preview"]["channels"];
  products: SalesBatchesModel["preview"]["products"];
  requirements: SalesBatchesModel["preview"]["requirements"];
  includedRows: number;
  excludedRowsCount: number;
  saleQuantity: number;
  blockingIssueCount: number;
  channelIds: number[];
  aggregate: { item: IngredientPlan["item"]; required: Prisma.Decimal }[];
};

const gridRowLimit = maximumWorkbookRows;
const gridColumnLimit = maximumWorkbookColumns;
const dataRowLimit = maximumWorkbookRows;
const maximumBatchQuantity = 2147483647;

function configOf(batch: {
  organizationId: string;
  branchId: number;
  id: number;
  sheetNames: string[];
  sheetName: string | null;
  headerRow: number | null;
  channelColumn: string | null;
  productColumn: string | null;
  quantityColumn: string | null;
  productCodeColumn: string | null;
  excludedRows: number[];
}): BatchConfig {
  return {
    organizationId: batch.organizationId,
    branchId: batch.branchId,
    id: batch.id,
    sheetNames: batch.sheetNames,
    sheetName: batch.sheetName,
    headerRow: batch.headerRow,
    channelColumn: batch.channelColumn,
    productColumn: batch.productColumn,
    quantityColumn: batch.quantityColumn,
    productCodeColumn: batch.productCodeColumn,
    excludedRows: batch.excludedRows,
  };
}

function productKeyOf(
  productCode: string,
  productValue: string,
): string | null {
  if (productCode !== "") return `code:${productCode}`;
  if (productValue !== "") return `text:${productValue}`;
  return null;
}

/**
 * The single source value of a channel-less Modpos report. It flows through
 * the existing explicit channel mapping, so it is always resolved to a real
 * active channel and never treated as a channel by itself.
 */
const modposSource = "Modpos";

/**
 * A channel-less configuration stays valid only while the saved worksheet,
 * header row and columns are exactly the ones the Modpos header produces.
 */
function modposMatches(
  report: ModposReport | null,
  config: Pick<
    BatchConfig,
    | "sheetName"
    | "headerRow"
    | "productColumn"
    | "quantityColumn"
    | "productCodeColumn"
  >,
): boolean {
  return (
    report !== null &&
    report.sheetName === config.sheetName &&
    report.headerRow === config.headerRow &&
    report.productColumn === config.productColumn &&
    report.quantityColumn === config.quantityColumn &&
    report.productCodeColumn === config.productCodeColumn
  );
}

function modposNotes(report: ModposReport, channelLess: boolean): RowIssue[] {
  const notes: RowIssue[] = [
    {
      code: "MODPOS_QUANTITY_AS_REPORTED",
      message:
        "Quantities are used exactly as reported in Adedi; İkram Adet, Fixler and Biletler are never added, subtracted or split.",
      blocking: false,
    },
    {
      code: "MODPOS_REPORT_COMPONENTS",
      message:
        "Report rows can be menus or combos; every row is recorded as exactly one mapped recipe, so verify that the recipe matches the reported product.",
      blocking: false,
    },
    {
      code: "MODPOS_MONEY_IGNORED",
      message:
        "Tutar, B. Tutar, Maliyet, Kar and Kar Oranı are not imported; recorded prices come from each mapped recipe's selling price.",
      blocking: false,
    },
    ...(channelLess
      ? [
          {
            code: "MODPOS_SINGLE_CHANNEL",
            message:
              "This report has no channel column; every included row uses the single source value Modpos, which must be mapped to one active sales channel.",
            blocking: false,
          },
        ]
      : []),
    {
      code: "MODPOS_REVIEW_ROWS",
      message:
        "Rows without a product code are ignored automatically; review coded discount, message and waste rows and exclude them explicitly.",
      blocking: false,
    },
  ];
  const dateNotes: Record<ModposDateIssue, string> = {
    MODPOS_DATE_MISSING:
      "The report header has no readable date; set the business date explicitly.",
    MODPOS_DATE_INVALID:
      "The report header date is not a valid calendar date and was not normalized; set the business date explicitly.",
    MODPOS_DATE_RANGE:
      "The report header covers more than one day; the business date was left unchanged, so set the single sales day explicitly.",
  };
  if (report.dateIssue !== null)
    notes.push({
      code: report.dateIssue,
      message: dateNotes[report.dateIssue],
      blocking: false,
    });
  return notes;
}

function requirementSummary(
  aggregate: { item: IngredientPlan["item"]; required: Prisma.Decimal }[],
  balances: ReadonlyMap<number, Prisma.Decimal>,
): SalesBatchesModel["preview"]["requirements"] {
  return aggregate.map(({ item, required }) => {
    const available = balances.get(item.id) ?? new Decimal(0);
    return {
      itemUuid: item.uuid,
      itemName: item.name,
      itemUnits: item.unit?.code ?? "",
      required: required.toString(),
      available: available.toString(),
      missing: available.lt(required)
        ? required.sub(available).toString()
        : "0",
    };
  });
}

export abstract class SalesBatchesService {
  static async index(
    actor: TenantActor,
    query: SalesBatchesModel["query"],
  ): Promise<SalesBatchesModel["list"]> {
    const organizationId = actor.organizationId;
    const search = query.search?.trim();
    const where: Prisma.SalesBatchWhereInput = {
      organizationId,
      // A branch context never lists another branch's batches; the company
      // context aggregates every branch.
      ...(actor.branchId === null ? {} : { branchId: actor.branchId }),
      ...(search
        ? {
            OR: [
              { reference: { contains: search, mode: "insensitive" } },
              { sourceFileName: { contains: search, mode: "insensitive" } },
              { createdByName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.salesBatch.findMany({
        where,
        select: batchSummarySelect,
        orderBy: [{ id: "desc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.salesBatch.count({ where }),
    ]);
    return {
      items: rows.map((row) => SalesBatchesFormatter.toSummary(row)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async show(
    actor: TenantActor,
    uuid: string,
  ): Promise<SalesBatchesModel["detail"]> {
    const row = await prisma.salesBatch.findFirst({
      where: {
        organizationId: actor.organizationId,
        uuid,
        ...(actor.branchId === null ? {} : { branchId: actor.branchId }),
      },
      select: batchDetailSelect,
    });
    if (!row) throw new createError.NotFound("Sales batch was not found");
    return SalesBatchesFormatter.toDetail(row);
  }

  static async store(
    actor: TenantActor,
    file: File,
  ): Promise<SalesBatchesModel["detail"]> {
    assertWorkbookFile(file.name, file.size);
    if (file.size > workbookMaxBytes)
      throw new createError.PayloadTooLarge(
        "Workbooks must be 10 MB or smaller",
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    // The parser only runs after the byte signature has been accepted, and the
    // workbook is persisted only after it parsed successfully.
    const sheets = await readWorkbook(bytes);
    if (sheets.length === 0)
      throw new createError.UnprocessableEntity(
        "The workbook does not contain any worksheet",
      );
    const sheetNames = sheets.map((sheet) => sheet.name);
    // Only a verified printed Ürün Raporu header preselects the draft; any
    // other workbook stays an unconfigured, manually mapped draft.
    const modpos = sheets.reduce<ModposReport | null>(
      (found, sheet) => found ?? detectModposReport(sheet.name, sheet.rows),
      null,
    );
    const businessDate =
      modpos !== null && modpos.dateIssue === null && modpos.dateFrom !== null
        ? OrderService.day(modpos.dateFrom)
        : OrderService.today();
    const sourceFileName =
      file.name.split(/[\\/]/).pop()?.slice(0, 255) || "workbook.xlsx";
    const mediaUuid = await MediaFilesService.storeTemporaryWorkbook(
      actor,
      sourceFileName,
      bytes,
    );

    let uuid = "";
    try {
      uuid = await prisma.$transaction(
        async (db) => {
          // Branch lifecycle guard first; the batch is fixed to this branch
          // for its whole lifetime.
          const branch = await BranchesService.requireActor(db, actor, {
            active: true,
          });
          // Reference generation shares the global catalog lock order.
          await CatalogService.lockItem(db);
          const organizationId = actor.organizationId;
          const reference = await OrderService.reference(
            "SALESBATCH_REFERENCE_PATTERN",
            undefined,
            async () =>
              (
                await db.salesBatch.aggregate({
                  where: { organizationId },
                  _max: { referenceInt: true },
                })
              )._max.referenceInt ?? 0n,
            async (value) =>
              (await db.salesBatch.findUnique({
                where: {
                  organizationId_reference: {
                    organizationId,
                    reference: value,
                  },
                },
                select: { id: true },
              })) != null,
          );
          const createdBy = await db.user.findUnique({
            where: { id: actor.userId },
            select: { name: true },
          });
          const batch = await db.salesBatch.create({
            data: {
              organizationId,
              branchId: branch.branchId,
              reference: reference.reference,
              referenceInt: reference.referenceInt,
              businessDate,
              status: salesBatchStatus.draft,
              sourceFileName,
              sourceFile: mediaUuid,
              sourceFileSize: bytes.length,
              sheetNames,
              sheetName: modpos?.sheetName ?? null,
              headerRow: modpos?.headerRow ?? null,
              productColumn: modpos?.productColumn ?? null,
              quantityColumn: modpos?.quantityColumn ?? null,
              productCodeColumn: modpos?.productCodeColumn ?? null,
              excludedRows: modpos?.excludedRows ?? [],
              createdById: actor.userId,
              createdByName: createdBy?.name ?? "",
            },
            select: { uuid: true },
          });
          await MediaFilesService.claimWorkbook(
            db,
            actor,
            mediaUuid,
            batch.uuid,
          );
          return batch.uuid;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 20000,
        },
      );
    } catch (error) {
      // The database never bound this upload; deferred cleanup removes it.
      await MediaFilesService.discardWorkbook(actor, mediaUuid).catch(
        (cleanupError) => logError(cleanupError),
      );
      throw error;
    }
    return SalesBatchesService.show(actor, uuid);
  }

  static async preview(
    actor: TenantActor,
    uuid: string,
    sheet?: string | null,
  ): Promise<SalesBatchesModel["preview"]> {
    const batch = await SalesBatchesService.loadBatch(actor, uuid);
    const config = configOf(batch);
    const sheetName = sheet ?? batch.sheetName;
    if (sheetName !== null && !batch.sheetNames.includes(sheetName))
      throw new createError.UnprocessableEntity(
        `Worksheet ${sheetName} is not part of this workbook`,
      );
    const rows =
      sheetName === null
        ? []
        : await readWorkbookSheet(
            await MediaFilesService.readWorkbook(actor.organizationId, uuid),
            sheetName,
          );
    // Exploring another worksheet returns only its raw grid; column mappings
    // belong to the persisted worksheet until the draft is saved.
    const explored = sheetName !== batch.sheetName;
    const analysis = await SalesBatchesService.analyze(
      prisma,
      actor.organizationId,
      explored
        ? {
            ...config,
            sheetName,
            headerRow: null,
            channelColumn: null,
            productColumn: null,
            quantityColumn: null,
            productCodeColumn: null,
            excludedRows: [],
          }
        : config,
      rows,
    );
    return SalesBatchesService.toPreview(analysis, batch.branch);
  }

  static async update(
    actor: TenantActor,
    uuid: string,
    body: SalesBatchesModel["patch"],
  ): Promise<SalesBatchesModel["detail"]> {
    const organizationId = actor.organizationId;
    await prisma.$transaction(
      async (db) => {
        // Branch lifecycle guard first, then the same catalog -> recipe order
        // as processing so a draft cannot change under an in-flight process.
        const branch = await BranchesService.requireActor(db, actor, {
          active: true,
        });
        await CatalogService.lockItem(db);
        await RecipeService.lock(db);

        const existing = await db.salesBatch.findFirst({
          where: { organizationId, uuid, branchId: branch.branchId },
          select: {
            id: true,
            branchId: true,
            status: true,
            sheetNames: true,
            sheetName: true,
            headerRow: true,
            channelColumn: true,
            productColumn: true,
            quantityColumn: true,
            productCodeColumn: true,
            excludedRows: true,
          },
        });
        if (!existing)
          throw new createError.NotFound("Sales batch was not found");
        if (existing.status !== salesBatchStatus.draft)
          throw new createError.UnprocessableEntity(
            "Processed sales batches cannot be edited",
          );

        const sheetName = body.sheet?.sheetName ?? existing.sheetName;
        const headerRow = body.sheet?.headerRow ?? existing.headerRow;
        const channelColumn =
          body.sheet === undefined
            ? existing.channelColumn
            : body.sheet.channelColumn;
        const productColumn =
          body.sheet?.productColumn ?? existing.productColumn;
        const quantityColumn =
          body.sheet?.quantityColumn ?? existing.quantityColumn;
        const productCodeColumn =
          body.sheet === undefined
            ? existing.productCodeColumn
            : (body.sheet.productCodeColumn ?? null);

        if (sheetName !== null && !existing.sheetNames.includes(sheetName))
          throw new createError.UnprocessableEntity(
            `Worksheet ${sheetName} is not part of this workbook`,
          );
        if (!validColumn(channelColumn))
          throw new createError.UnprocessableEntity("Invalid channel column");
        if (!validColumn(productColumn))
          throw new createError.UnprocessableEntity("Invalid product column");
        if (!validColumn(quantityColumn))
          throw new createError.UnprocessableEntity("Invalid quantity column");
        if (!validColumn(productCodeColumn))
          throw new createError.UnprocessableEntity(
            "Invalid product code column",
          );
        const usedColumns = [
          channelColumn,
          productColumn,
          quantityColumn,
          productCodeColumn,
        ].filter((column): column is string => column !== null);
        if (new Set(usedColumns).size !== usedColumns.length)
          throw new createError.UnprocessableEntity(
            "Channel, product, quantity and product-code columns must be different",
          );

        const bytes = await MediaFilesService.readWorkbook(
          organizationId,
          uuid,
        );
        const rows =
          sheetName === null ? [] : await readWorkbookSheet(bytes, sheetName);
        const lastRow = lastRowNumber(rows);
        if (sheetName !== null && headerRow !== null && headerRow > lastRow)
          throw new createError.UnprocessableEntity(
            "The header row must be inside the worksheet",
          );

        const modpos =
          sheetName === null ? null : detectModposReport(sheetName, rows);
        const modposConfig = {
          sheetName,
          headerRow,
          productColumn,
          quantityColumn,
          productCodeColumn,
        };
        const modposHeader = modposMatches(modpos, modposConfig);
        const completeSheet =
          sheetName !== null &&
          headerRow !== null &&
          productColumn !== null &&
          quantityColumn !== null;
        // Only an explicit sheet configuration can be channel-less, and only
        // while its columns are exactly the recognized Modpos header. A
        // date-only or exclusion-only patch on an unconfigured draft is not
        // affected.
        if (
          body.sheet !== undefined &&
          completeSheet &&
          channelColumn === null &&
          !modposHeader
        )
          throw new createError.UnprocessableEntity(
            "A report without a channel column must be a recognized Modpos Ürün Raporu with its printed product code, product and quantity columns",
          );

        const configured =
          completeSheet && (channelColumn !== null || modposHeader);

        const resetExclusions =
          body.sheet !== undefined &&
          (body.sheet.sheetName !== existing.sheetName ||
            body.sheet.headerRow !== existing.headerRow);
        const excludedRows = [
          ...new Set(
            (
              body.excludedRows ??
              (resetExclusions ? [] : existing.excludedRows)
            )
              .filter((row) => row > 0)
              .sort((left, right) => left - right),
          ),
        ];
        if (!configured && excludedRows.length > 0)
          throw new createError.UnprocessableEntity(
            "Configure the worksheet and columns before excluding rows",
          );
        if (configured) {
          const header = headerRow as number;
          for (const row of excludedRows) {
            if (row <= header || row > lastRow)
              throw new createError.UnprocessableEntity(
                `Excluded row ${row} is outside the data rows`,
              );
          }
        }

        const channelValues = new Set<string>();
        const productKeys = new Set<string>();
        if (configured) {
          const header = headerRow as number;
          const productSource = productColumn as string;
          for (let row = header + 1; row <= lastRow; row += 1) {
            const channelFull =
              channelColumn === null
                ? modposSource
                : cellText(cellAt(rows, row, channelColumn));
            const productFull = cellText(cellAt(rows, row, productSource));
            const codeFull =
              productCodeColumn === null
                ? ""
                : cellText(cellAt(rows, row, productCodeColumn));
            // With a product-code column the code is the row identity, so a
            // blank-code row never contributes a channel or product key.
            if (productCodeColumn !== null && codeFull === "") continue;
            const channel = channelFull.slice(0, 200);
            if (channel !== "") channelValues.add(channel);
            if (
              channelFull.length > 200 ||
              productFull.length > 200 ||
              codeFull.length > 100
            )
              continue;
            const key = productKeyOf(codeFull, productFull);
            if (key !== null) productKeys.add(key);
          }
        }

        const businessDate =
          body.businessDate === undefined
            ? undefined
            : OrderService.day(body.businessDate);
        const config: BatchConfig = {
          organizationId,
          branchId: existing.branchId,
          id: existing.id,
          sheetNames: existing.sheetNames,
          sheetName,
          headerRow,
          channelColumn,
          productColumn,
          quantityColumn,
          productCodeColumn,
          excludedRows,
        };

        for (const mapping of body.channelMappings ?? []) {
          const sourceValue = mapping.sourceValue.trim();
          if (!channelValues.has(sourceValue))
            throw new createError.UnprocessableEntity(
              `Channel value ${sourceValue} is not present in this worksheet`,
            );
          if (mapping.channelUuid === null) {
            // A null row is a deliberate batch-local override; it must win
            // over any reusable organization mapping for the same value.
            await db.salesBatchChannel.upsert({
              where: {
                organizationId_batchId_sourceValue: {
                  organizationId,
                  batchId: existing.id,
                  sourceValue,
                },
              },
              create: {
                organizationId,
                batchId: existing.id,
                sourceValue,
                channelId: null,
              },
              update: { channelId: null },
            });
            continue;
          }
          const channel = await db.salesChannel.findFirst({
            where: {
              organizationId,
              uuid: mapping.channelUuid.toLowerCase(),
              active: true,
            },
            select: { id: true },
          });
          if (!channel)
            throw new createError.UnprocessableEntity(
              `Sales channel for ${sourceValue} must be an active channel`,
            );
          await db.salesBatchChannel.upsert({
            where: {
              organizationId_batchId_sourceValue: {
                organizationId,
                batchId: existing.id,
                sourceValue,
              },
            },
            create: {
              organizationId,
              batchId: existing.id,
              sourceValue,
              channelId: channel.id,
            },
            update: { channelId: channel.id },
          });
          // Reuse the explicit choice for later uploads of the same source
          // value; this is exact identity, never a guessed match.
          await db.salesChannelMapping.upsert({
            where: {
              organizationId_sourceValue: { organizationId, sourceValue },
            },
            create: { organizationId, sourceValue, channelId: channel.id },
            update: { channelId: channel.id },
          });
        }

        for (const mapping of body.productMappings ?? []) {
          const productKey = mapping.productKey;
          // Coded rows resolve by recipe code alone; a manual mapping for them
          // is never accepted. Clearing a legacy code row stays possible.
          if (mapping.recipeUuid !== null && productKey.startsWith("code:"))
            throw new createError.UnprocessableEntity(
              "Coded products are matched by recipe code and cannot be mapped manually",
            );
          if (!productKeys.has(productKey))
            throw new createError.UnprocessableEntity(
              `Product ${productKey} is not present in this worksheet`,
            );
          if (mapping.recipeUuid === null) {
            // A mapping is branch-scoped: clearing it here never changes
            // another branch's source mapping.
            await db.salesProductMapping.deleteMany({
              where: {
                organizationId,
                branchId: existing.branchId,
                productKey,
              },
            });
            continue;
          }
          const recipe = await SalesBatchesService.activeRecipe(
            db,
            organizationId,
            existing.branchId,
            mapping.recipeUuid,
          );
          if (!recipe)
            throw new createError.UnprocessableEntity(
              `Recipe for ${productKey} must be an active recipe of this branch`,
            );
          const label = productKey.replace(/^text:/, "");
          await db.salesProductMapping.upsert({
            where: {
              organizationId_branchId_productKey: {
                organizationId,
                branchId: existing.branchId,
                productKey,
              },
            },
            create: {
              organizationId,
              branchId: existing.branchId,
              productKey,
              productLabel: label,
              sourceCode: null,
              sourceText: label,
              recipeId: recipe.key,
            },
            update: {
              productLabel: label,
              recipeId: recipe.key,
              sourceCode: null,
              sourceText: label,
            },
          });
        }

        const analysis = await SalesBatchesService.analyze(
          db,
          organizationId,
          config,
          rows,
        );
        if (analysis.saleQuantity > maximumBatchQuantity)
          throw new createError.UnprocessableEntity(
            "Total batch quantity exceeds the supported range",
          );
        const saved = await db.salesBatch.updateMany({
          where: {
            organizationId,
            id: existing.id,
            status: salesBatchStatus.draft,
          },
          data: {
            ...(businessDate === undefined ? {} : { businessDate }),
            sheetName,
            headerRow,
            channelColumn,
            productColumn,
            quantityColumn,
            productCodeColumn,
            excludedRows,
            rowCount: analysis.includedRows,
            quantityTotal: analysis.saleQuantity,
            channelCount: analysis.channelIds.length,
          },
        });
        if (saved.count !== 1)
          throw new createError.Conflict(
            "This batch changed; reload and retry",
          );
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 20000,
      },
    );

    return SalesBatchesService.show(actor, uuid);
  }

  static async process(
    actor: TenantActor,
    uuid: string,
  ): Promise<SalesBatchesModel["detail"]> {
    const organizationId = actor.organizationId;
    await prisma.$transaction(
      async (db) => {
        // Branch lifecycle guard first; then the global lock order: catalog
        // 814203, recipes 814204, stock 814205, finance 814207.
        const branch = await BranchesService.requireActor(db, actor, {
          active: true,
        });
        await CatalogService.lockItem(db);
        await RecipeService.lock(db);
        await ItemStockService.lock(db);
        // Finance is locked after stock so a concurrent receipt and this batch
        // operation cannot interleave.
        await FinanceService.lock(db);

        const batch = await db.salesBatch.findFirst({
          where: { organizationId, uuid, branchId: branch.branchId },
          select: {
            ...batchDetailSelect,
            organizationId: true,
            branchId: true,
            id: true,
          },
        });
        if (!batch) throw new createError.NotFound("Sales batch was not found");
        if (batch.status !== salesBatchStatus.draft)
          throw new createError.Conflict("This batch is already processed");

        const bytes = await MediaFilesService.readWorkbook(
          organizationId,
          uuid,
        );
        const rows =
          batch.sheetName === null
            ? []
            : await readWorkbookSheet(bytes, batch.sheetName);
        const analysis = await SalesBatchesService.analyze(
          db,
          organizationId,
          configOf(batch),
          rows,
        );
        if (!analysis.configured)
          throw new createError.UnprocessableEntity(
            "Select the worksheet, header row and source columns before processing",
          );
        if (analysis.includedRows === 0)
          throw new createError.UnprocessableEntity(
            "The batch does not include any sale row",
          );
        if (analysis.saleQuantity > maximumBatchQuantity)
          throw new createError.UnprocessableEntity(
            "Total batch quantity exceeds the supported range",
          );
        if (analysis.blockingIssueCount > 0)
          throw Object.assign(
            new createError.UnprocessableEntity(
              "The batch contains blocking row issues",
            ),
            {
              apiCode: "SALES_BATCH_INVALID",
              details: {
                issues: analysis.allRows
                  .filter((row) => row.issues.some((issue) => issue.blocking))
                  .map((row) => ({
                    row: row.row,
                    channel: row.channelValue,
                    product: row.productValue,
                    quantity: row.quantityRaw,
                    issues: row.issues.filter((issue) => issue.blocking),
                  })),
              },
            },
          );
        const balances = await ItemStockService.balances(
          db,
          organizationId,
          batch.branchId,
          analysis.aggregate.map((entry) => entry.item.id),
        );
        const shortages = SalesService.shortagesFor(
          analysis.aggregate.map((entry) => ({
            item: entry.item,
            required: entry.required,
            unitCode: entry.item.unit?.code ?? "",
          })),
          balances,
        );
        if (shortages.length > 0) throw SalesService.shortage(shortages);

        const resolvedChannels = new Map<
          string,
          { channelId: number; sourceValue: string }
        >();
        for (const row of analysis.allRows) {
          if (row.included && row.channelValue !== "" && row.channelId !== null)
            resolvedChannels.set(row.channelValue, {
              channelId: row.channelId,
              sourceValue: row.channelValue,
            });
        }
        for (const resolved of resolvedChannels.values()) {
          await db.salesBatchChannel.upsert({
            where: {
              organizationId_batchId_sourceValue: {
                organizationId,
                batchId: batch.id,
                sourceValue: resolved.sourceValue,
              },
            },
            create: {
              organizationId,
              batchId: batch.id,
              sourceValue: resolved.sourceValue,
              channelId: resolved.channelId,
            },
            update: { channelId: resolved.channelId },
          });
          await db.salesChannelMapping.upsert({
            where: {
              organizationId_sourceValue: {
                organizationId,
                sourceValue: resolved.sourceValue,
              },
            },
            create: {
              organizationId,
              sourceValue: resolved.sourceValue,
              channelId: resolved.channelId,
            },
            update: { channelId: resolved.channelId },
          });
        }

        const createdBy = await db.user.findUnique({
          where: { id: actor.userId },
          select: { name: true },
        });
        const createdByName = createdBy?.name ?? "";
        const saleRows = analysis.allRows.filter(
          (row) =>
            row.included &&
            row.quantity !== null &&
            row.recipe !== null &&
            row.channelId !== null &&
            row.channelUuid !== null &&
            row.channelName !== null,
        );
        // References are preallocated once under the catalog lock instead of
        // running an aggregate per row.
        const nextReference =
          (
            await db.build.aggregate({
              where: { organizationId },
              _max: { referenceInt: true },
            })
          )._max.referenceInt ?? 0n;
        const referencePattern = OrderService.pattern(
          "BUILDORDER_REFERENCE_PATTERN",
        );
        let referenceOffset = 0;
        for (const row of saleRows) {
          const recipe = row.recipe;
          const quantity = row.quantity;
          const channelId = row.channelId;
          const channelUuid = row.channelUuid;
          const channelName = row.channelName;
          if (
            recipe === null ||
            quantity === null ||
            channelId === null ||
            channelUuid === null ||
            channelName === null
          )
            throw new createError.InternalServerError(
              "Sale batch row was not planned",
            );
          await SalesService.create(db, actor, {
            organizationId,
            branchId: batch.branchId,
            recipe,
            requirements: row.requirements,
            quantity,
            requestKey: `batch:${batch.uuid}:${row.row}`,
            channel: {
              id: channelId,
              uuid: channelUuid,
              name: channelName,
            },
            businessDate: batch.businessDate,
            createdByName,
            batch: {
              id: batch.id,
              uuid: batch.uuid,
              reference: batch.reference,
            },
            source: {
              sheet: batch.sheetName ?? "",
              row: row.row,
              channelText: row.channelValue,
              productText: row.productValue,
            },
            reference: OrderService.format(
              referencePattern,
              nextReference + BigInt((referenceOffset += 1)),
            ),
          });
        }

        const saved = await db.salesBatch.updateMany({
          where: {
            organizationId,
            id: batch.id,
            status: salesBatchStatus.draft,
          },
          data: {
            status: salesBatchStatus.processed,
            processedAt: new Date(),
            rowCount: analysis.includedRows,
            quantityTotal: analysis.saleQuantity,
            channelCount: analysis.channelIds.length,
          },
        });
        if (saved.count !== 1)
          throw new createError.Conflict(
            "This batch was processed concurrently; reload and retry",
          );
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 120000,
      },
    );
    return SalesBatchesService.show(actor, uuid);
  }

  static async destroy(
    actor: TenantActor,
    uuid: string,
  ): Promise<{ success: true }> {
    const organizationId = actor.organizationId;
    await prisma.$transaction(
      async (db) => {
        // Branch lifecycle guard first; reversal writes back into the batch
        // branch only.
        const branch = await BranchesService.requireActor(db, actor, {
          active: true,
        });
        await CatalogService.lockItem(db);
        await RecipeService.lock(db);
        await ItemStockService.lock(db);
        // Finance is locked after stock so a concurrent receipt and this batch
        // operation cannot interleave.
        await FinanceService.lock(db);

        const batch = await db.salesBatch.findFirst({
          where: { organizationId, uuid, branchId: branch.branchId },
          select: {
            id: true,
            uuid: true,
            branchId: true,
            reference: true,
            status: true,
            _count: { select: { zReports: true } },
            builds: {
              select: {
                id: true,
                uuid: true,
                branchId: true,
                reference: true,
                receipts: { select: { uuid: true } },
                consumptions: {
                  select: {
                    buildId: true,
                    itemId: true,
                    itemUuidRef: true,
                    quantity: true,
                    buildComponent: { select: { componentName: true } },
                  },
                },
              },
            },
          },
        });
        if (!batch) throw new createError.NotFound("Sales batch was not found");

        // Financial history is never deleted. Any receipt history on a sale of
        // this batch permanently blocks deletion, even when the receipt was
        // reversed afterwards: reversal rows stay as immutable history and the
        // build FK is RESTRICT.
        const receiptSales = batch.builds.filter(
          (build) => build.receipts.length > 0,
        );
        if (receiptSales.length > 0)
          throw Object.assign(
            new createError.UnprocessableEntity(
              "This batch's sales have receipt history and the batch cannot be deleted",
            ),
            {
              apiCode: "SALES_BATCH_RECEIPTS",
              details: {
                sales: receiptSales.map((build) => ({
                  uuid: build.uuid,
                  reference: build.reference,
                })),
              },
            },
          );

        // Bank POS Z reports are reconciliation evidence that must be detached
        // deliberately. The composite RESTRICT foreign key is the authoritative
        // guard against a concurrent attach; this early check avoids reversing
        // stock only to roll the whole transaction back.
        if (batch._count.zReports > 0)
          throw Object.assign(
            new createError.Conflict(
              "This batch has linked bank POS Z reports and cannot be deleted; detach those reports first",
            ),
            {
              apiCode: "SALES_BATCH_Z_REPORTS",
              details: { reportCount: batch._count.zReports },
            },
          );

        if (batch.status === salesBatchStatus.processed) {
          const consumptions = batch.builds.flatMap((build) =>
            build.consumptions.map((consumption) => ({
              ...consumption,
              buildBranchId: build.branchId,
              buildReference: build.reference,
              buildUuid: build.uuid,
            })),
          );
          const missing = consumptions.filter(
            (consumption) => consumption.itemId === null,
          );
          if (missing.length > 0)
            throw Object.assign(
              new createError.UnprocessableEntity(
                "The original stock consumption cannot be reversed because an item no longer exists",
              ),
              {
                apiCode: "SALES_BATCH_REVERSAL_BLOCKED",
                details: {
                  items: missing.map((consumption) => ({
                    componentName: consumption.buildComponent.componentName,
                    itemUuid: consumption.itemUuidRef,
                    quantity: consumption.quantity.toString(),
                  })),
                },
              },
            );
          for (const consumption of consumptions) {
            if (consumption.itemId === null)
              throw new createError.InternalServerError(
                "Sale batch reversal plan is inconsistent",
              );
            await ItemStockService.change(
              db,
              {
                organizationId,
                branchId: consumption.buildBranchId,
                userId: actor.userId,
              },
              consumption.itemId,
              "add",
              consumption.quantity,
              {
                notes: `Reversed sale ${consumption.buildReference} (batch ${batch.reference})`,
                deltas: {
                  kind: "sale-batch-reversal",
                  salesBatchUuid: batch.uuid,
                  salesBatchReference: batch.reference,
                  buildReference: consumption.buildReference,
                  saleUuid: consumption.buildUuid,
                  itemUuid: consumption.itemUuidRef,
                },
              },
            );
          }

          // BuildConsumption.buildComponent is ON DELETE NO ACTION, so the
          // child rows are removed explicitly before their parents/host sale.
          const buildIds = batch.builds.map((build) => build.id);
          await db.buildConsumption.deleteMany({
            where: { organizationId, buildId: { in: buildIds } },
          });
          await db.buildComponent.deleteMany({
            where: { organizationId, buildId: { in: buildIds } },
          });
          await db.build.deleteMany({
            where: { organizationId, id: { in: buildIds } },
          });
        }

        await db.salesBatchChannel.deleteMany({
          where: { organizationId, batchId: batch.id },
        });
        await db.salesBatch.delete({
          where: { organizationId_id: { organizationId, id: batch.id } },
        });
        // The file bytes stay until deferred cleanup; only the binding is
        // released, and only if this transaction commits.
        await MediaFilesService.releaseWorkbook(db, organizationId, batch.uuid);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 120000,
      },
    );
    return { success: true };
  }

  static async download(
    actor: TenantActor,
    uuid: string,
  ): Promise<{ bytes: Uint8Array; fileName: string }> {
    const batch = await prisma.salesBatch.findFirst({
      where: {
        organizationId: actor.organizationId,
        uuid,
        ...(actor.branchId === null ? {} : { branchId: actor.branchId }),
      },
      select: websiteSelect,
    });
    if (!batch) throw new createError.NotFound("Sales batch was not found");
    return {
      bytes: await MediaFilesService.readWorkbook(actor.organizationId, uuid),
      fileName: batch.sourceFileName,
    };
  }

  /**
   * Resolves an effective recipe selector inside one branch and requires it to
   * be available (active/activated) there. Mapping target selection does not
   * require the `sellable` flag: a mapped but non-sellable recipe is reported
   * per row by the analysis instead of being unmappable. The returned effective
   * definition carries the stable canonical identity a product mapping stores,
   * so a later branch activation, customization, or reset is picked up without
   * rewriting the mapping.
   */
  private static async activeRecipe(
    db: Prisma.TransactionClient | typeof prisma,
    organizationId: string,
    branchId: number,
    uuid: string,
  ): Promise<EffectiveRecipe | null> {
    const root = await db.recipe.findFirst({
      where: {
        organizationId,
        uuid: uuid.toLowerCase(),
        sourceRecipeId: null,
        OR: [{ branchId: null }, { branchId }],
      },
      select: { id: true },
    });
    if (!root) return null;
    const graph = await RecipeService.graph(db, organizationId, branchId, [
      root.id,
    ]);
    const recipe = graph.get(root.id);
    return recipe && recipe.active ? recipe : null;
  }

  private static async loadBatch(
    actor: TenantActor,
    uuid: string,
  ): Promise<
    BatchDetailRecord & { organizationId: string; branchId: number; id: number }
  > {
    const batch = await prisma.salesBatch.findFirst({
      where: {
        organizationId: actor.organizationId,
        uuid,
        ...(actor.branchId === null ? {} : { branchId: actor.branchId }),
      },
      select: {
        ...batchDetailSelect,
        organizationId: true,
        branchId: true,
        id: true,
      },
    });
    if (!batch) throw new createError.NotFound("Sales batch was not found");
    return batch;
  }

  private static async analyze(
    db: Prisma.TransactionClient | typeof prisma,
    organizationId: string,
    config: BatchConfig,
    rows: WorkbookRow[],
  ): Promise<Analysis> {
    const lastRow = lastRowNumber(rows);
    const usedColumns = usedColumnCount(rows);
    const gridWidth = Math.min(usedColumns, gridColumnLimit);
    const gridRows = Math.min(lastRow, gridRowLimit);
    const grid = Array.from({ length: gridRows }, (_, index) => ({
      row: index + 1,
      cells: Array.from({ length: gridWidth }, (__, column) =>
        cellText(cellAt(rows, index + 1, columnLetter(column))).slice(0, 500),
      ),
    }));

    const modpos =
      config.sheetName === null
        ? null
        : detectModposReport(config.sheetName, rows);

    const base = {
      sheetNames: config.sheetNames,
      sheetName: config.sheetName,
      headerRow: config.headerRow,
      channelColumn: config.channelColumn,
      productColumn: config.productColumn,
      quantityColumn: config.quantityColumn,
      productCodeColumn: config.productCodeColumn,
      excludedRows: config.excludedRows,
      modpos:
        modpos === null
          ? null
          : {
              sheetName: modpos.sheetName,
              headerRow: modpos.headerRow,
              productCodeColumn: modpos.productCodeColumn,
              productColumn: modpos.productColumn,
              quantityColumn: modpos.quantityColumn,
              dateFrom: modpos.dateFrom,
              dateTo: modpos.dateTo,
              notes: modposNotes(modpos, config.channelColumn === null),
            },
      grid,
      gridTruncated: lastRow > gridRowLimit,
      cellsTruncated: usedColumns > gridColumnLimit,
    };

    const configured =
      config.sheetName !== null &&
      config.headerRow !== null &&
      config.productColumn !== null &&
      config.quantityColumn !== null &&
      (config.channelColumn !== null || modposMatches(modpos, config));
    if (!configured) {
      return {
        configured: false,
        ...base,
        currencyCode: null,
        rows: [],
        allRows: [],
        rowsTruncated: false,
        emptyRowCount: 0,
        channels: [],
        products: [],
        requirements: [],
        includedRows: 0,
        excludedRowsCount: 0,
        saleQuantity: 0,
        blockingIssueCount: 0,
        channelIds: [],
        aggregate: [],
      };
    }

    // The preview must use exactly the currency a write would capture: the
    // fixed system currency. A stored finance row in another code, or a stored
    // code the catalog no longer accepts, blocks every included row instead of
    // previewing prices under an alternate currency. Reads never create a row.
    const currencyCode = await SystemPreferencesService.defaultCurrency(db);
    const financeCurrency = await FinanceService.currentCurrency(
      db,
      organizationId,
    );
    const financeInactive =
      currencyCode !== null && !CurrencyCatalog.active(currencyCode);
    const financeConflict =
      currencyCode !== null &&
      financeCurrency !== null &&
      financeCurrency !== currencyCode;
    const financeIssue: RowIssue | null =
      currencyCode === null
        ? null
        : financeInactive
          ? {
              code: "FINANCE_CURRENCY_INACTIVE",
              message: `The system currency ${currencyCode} is not an active ISO 4217 code; no sales can be recorded in it`,
              blocking: true,
            }
          : financeConflict
            ? {
                code: "FINANCE_CURRENCY_CONFLICT",
                message: `This organization records money in ${financeCurrency}, but the fixed system currency is ${currencyCode}; new sales cannot mix currencies`,
                blocking: true,
              }
            : null;

    const headerRow = config.headerRow as number;
    const channelColumn = config.channelColumn;
    const productColumn = config.productColumn as string;
    const quantityColumn = config.quantityColumn as string;

    const rawRows: {
      row: number;
      cells: string[];
      channelValue: string;
      productValue: string;
      productCode: string;
      productKey: string | null;
      quantityRaw: string;
      quantity: number | null;
      quantityIssue: string | null;
      lengthIssues: RowIssue[];
      excluded: boolean;
      empty: boolean;
    }[] = [];
    const excludedSet = new Set(config.excludedRows);
    for (let rowNumber = headerRow + 1; rowNumber <= lastRow; rowNumber += 1) {
      // A configured product-code column makes the code the row identity: a
      // blank-code row is skipped before any other cell is read, so it cannot
      // produce issues, mappings, summaries, counts or writes.
      const codeFull =
        config.productCodeColumn === null
          ? ""
          : cellText(cellAt(rows, rowNumber, config.productCodeColumn));
      if (config.productCodeColumn !== null && codeFull === "") continue;
      // The real channel cell decides blankness; the fixed Modpos source is
      // assigned only after a row proves it carries data.
      const channelCell =
        channelColumn === null
          ? ""
          : cellText(cellAt(rows, rowNumber, channelColumn));
      const channelFull = channelColumn === null ? modposSource : channelCell;
      const productFull = cellText(cellAt(rows, rowNumber, productColumn));
      const quantityFull = cellText(cellAt(rows, rowNumber, quantityColumn));
      const lengthIssues: RowIssue[] = [];
      if (channelFull.length > 200)
        lengthIssues.push({
          code: "CHANNEL_TOO_LONG",
          message: "Channel value is longer than 200 characters",
          blocking: true,
        });
      if (productFull.length > 200)
        lengthIssues.push({
          code: "PRODUCT_TOO_LONG",
          message: "Product value is longer than 200 characters",
          blocking: true,
        });
      if (codeFull.length > 100)
        lengthIssues.push({
          code: "PRODUCT_CODE_TOO_LONG",
          message: "Product code is longer than 100 characters",
          blocking: true,
        });
      if (quantityFull.length > 100)
        lengthIssues.push({
          code: "QUANTITY_TOO_LONG",
          message: "Quantity cell is longer than 100 characters",
          blocking: true,
        });
      const channelValue = channelFull.slice(0, 200);
      const productValue = productFull.slice(0, 200);
      const productCode = codeFull.slice(0, 100);
      const quantityRaw = quantityFull.slice(0, 100);
      const parsed = parseQuantity(quantityFull);
      rawRows.push({
        row: rowNumber,
        cells: Array.from({ length: Math.min(usedColumns, 30) }, (__, column) =>
          cellText(cellAt(rows, rowNumber, columnLetter(column))).slice(0, 500),
        ),
        channelValue,
        productValue,
        productCode,
        productKey:
          channelFull.length > 200 ||
          productFull.length > 200 ||
          codeFull.length > 100
            ? null
            : productKeyOf(productCode, productValue),
        quantityRaw,
        quantity: parsed.quantity,
        quantityIssue: parsed.issue,
        lengthIssues,
        excluded: excludedSet.has(rowNumber),
        empty:
          channelCell === "" &&
          productFull === "" &&
          quantityFull === "" &&
          codeFull === "",
      });
    }

    const channelMappings = await db.salesBatchChannel.findMany({
      where: { organizationId, batchId: config.id },
      select: {
        sourceValue: true,
        channel: { select: { id: true, uuid: true, name: true, active: true } },
      },
    });
    const channelBySource = new Map<
      string,
      {
        id: number;
        uuid: string;
        name: string;
        active: boolean;
      } | null
    >(channelMappings.map((mapping) => [mapping.sourceValue, mapping.channel]));
    const channelKeys = [
      ...new Set(
        rawRows.map((row) => row.channelValue).filter((value) => value !== ""),
      ),
    ];
    const channelFallbacks =
      channelKeys.length === 0
        ? []
        : await db.salesChannelMapping.findMany({
            where: { organizationId, sourceValue: { in: channelKeys } },
            select: {
              sourceValue: true,
              channel: {
                select: { id: true, uuid: true, name: true, active: true },
              },
            },
          });
    const fallbackBySource = new Map(
      channelFallbacks.map((mapping) => [mapping.sourceValue, mapping.channel]),
    );

    // A coded row resolves only by the exact effective recipe code of this
    // branch. A saved manual `code:` mapping is legacy metadata and never
    // overrides that match or stands in when no code matches. Only code-less
    // rows keep their existing exact text mappings.
    const codeValues = [
      ...new Set(
        rawRows.flatMap((row) =>
          row.productKey === null || !row.productKey.startsWith("code:")
            ? []
            : [row.productKey.slice("code:".length)],
        ),
      ),
    ];
    const textKeys = [
      ...new Set(
        rawRows.flatMap((row) =>
          row.productKey === null || row.productKey.startsWith("code:")
            ? []
            : [row.productKey],
        ),
      ),
    ];
    const productMappings =
      textKeys.length === 0
        ? []
        : await db.salesProductMapping.findMany({
            where: {
              organizationId,
              branchId: config.branchId,
              productKey: { in: textKeys },
            },
            select: { productKey: true, recipeId: true },
          });
    const recipeIdByKey = new Map(
      productMappings.map((mapping) => [mapping.productKey, mapping.recipeId]),
    );
    const codeRoots = await RecipeService.codeCandidates(
      db,
      organizationId,
      config.branchId,
      codeValues,
    );
    // One closure load for every mapped root and every code candidate inside
    // the batch branch; each row then expands against the same effective graph
    // instead of re-reading shared child recipes.
    const recipes = await SalesService.graph(
      db,
      organizationId,
      config.branchId,
      [
        ...new Set([
          ...productMappings.map((mapping) => mapping.recipeId),
          ...codeRoots,
        ]),
      ],
    );
    // Effective-code matches, keyed by the exact source code and deduped by
    // canonical identity: a company root and its branch customization are one
    // candidate, and an override that changed the code is not matched through
    // the obsolete root code.
    const codeSet = new Set(codeValues);
    const codeMatches = new Map<string, EffectiveRecipe[]>();
    for (const key of codeRoots) {
      const candidate = recipes.get(key);
      if (!candidate || candidate.code === null) continue;
      if (!codeSet.has(candidate.code)) continue;
      const matches = codeMatches.get(candidate.code);
      if (matches) matches.push(candidate);
      else codeMatches.set(candidate.code, [candidate]);
    }

    const analysisRows: AnalysisRow[] = [];
    const aggregate = new Map<
      number,
      { item: IngredientPlan["item"]; required: Prisma.Decimal }
    >();
    const channelIds = new Set<number>();
    let includedRows = 0;
    let saleQuantity = 0;
    let blockingIssueCount = 0;
    let emptyRowCount = 0;

    for (const raw of rawRows) {
      if (raw.excluded) {
        analysisRows.push({
          row: raw.row,
          excluded: true,
          included: false,
          cells: raw.cells,
          channelValue: raw.channelValue,
          productValue: raw.productValue,
          productCode: raw.productCode,
          productKey: raw.productKey,
          quantityRaw: raw.quantityRaw,
          quantity: raw.quantity,
          channelId: null,
          channelUuid: null,
          channelName: null,
          recipeUuid: null,
          recipeName: null,
          unitPrice: null,
          lineTotal: null,
          issues: [],
          recipe: null,
          requirements: [],
        });
        continue;
      }
      if (raw.empty) {
        emptyRowCount += 1;
        continue;
      }
      includedRows += 1;
      if (raw.quantity !== null) saleQuantity += raw.quantity;

      const issues: RowIssue[] = [...raw.lengthIssues];
      if (financeIssue !== null) issues.push(financeIssue);
      const channel =
        raw.channelValue === ""
          ? null
          : (channelBySource.get(raw.channelValue) ??
            fallbackBySource.get(raw.channelValue) ??
            null);
      if (raw.channelValue === "") {
        issues.push({
          code: "CHANNEL_MISSING",
          message: "Channel cell is empty",
          blocking: true,
        });
      } else if (channel === null) {
        issues.push({
          code: "CHANNEL_UNMAPPED",
          message: `Channel ${raw.channelValue} is not mapped`,
          blocking: true,
        });
      } else if (!channel.active) {
        issues.push({
          code: "CHANNEL_INACTIVE",
          message: `Channel ${channel.name} is inactive`,
          blocking: true,
        });
      }

      if (
        raw.productKey === null &&
        raw.productValue === "" &&
        raw.productCode === ""
      ) {
        issues.push({
          code: "PRODUCT_MISSING",
          message: "Product cell is empty",
          blocking: true,
        });
      }
      if (raw.quantityIssue !== null) {
        const messages: Record<string, string> = {
          QUANTITY_EMPTY: "Quantity cell is empty",
          QUANTITY_NOT_INTEGER: `Quantity ${raw.quantityRaw} is not a whole number`,
          QUANTITY_NOT_POSITIVE: "Quantity must be greater than zero",
          QUANTITY_TOO_LARGE: "Quantity is outside the supported range",
        };
        issues.push({
          code: raw.quantityIssue,
          message: messages[raw.quantityIssue] ?? "Quantity is invalid",
          blocking: true,
        });
      }

      // Resolve the product identity exactly. A coded row is matched only by
      // the effective recipe code in this branch; it is never mapped by hand
      // and never falls back to a legacy code mapping. A code-less row keeps
      // its explicit exact text mapping.
      let recipe: EffectiveRecipe | null = null;
      if (raw.productKey !== null) {
        if (raw.productKey.startsWith("code:")) {
          const candidates =
            codeMatches.get(raw.productKey.slice("code:".length)) ?? [];
          // An active exact identity wins, even beside an inactive duplicate;
          // only when no candidate is active does a unique inactive one
          // resolve, so the row reports its real blocker instead of looking
          // unmatched.
          const active = candidates.filter((candidate) => candidate.active);
          if (candidates.length === 0)
            issues.push({
              code: "PRODUCT_CODE_UNMATCHED",
              message: "No recipe matches this product code in this branch",
              blocking: true,
            });
          else if (active.length > 1)
            issues.push({
              code: "PRODUCT_CODE_AMBIGUOUS",
              message:
                "More than one active recipe matches this product code in this branch",
              blocking: true,
            });
          else if (active.length === 0 && candidates.length > 1)
            issues.push({
              code: "PRODUCT_CODE_AMBIGUOUS",
              message:
                "More than one inactive recipe matches this product code in this branch",
              blocking: true,
            });
          else recipe = active[0] ?? candidates[0] ?? null;
        } else {
          const recipeId = recipeIdByKey.get(raw.productKey);
          recipe =
            recipeId === undefined ? null : (recipes.get(recipeId) ?? null);
          if (recipe === null)
            issues.push({
              code: "PRODUCT_UNMAPPED",
              message: `Product ${raw.productValue || raw.productCode} is not mapped to a recipe`,
              blocking: true,
            });
        }
      }
      // An inactive identity is a blocking gate of its own, independent of
      // every other row issue; such a row never plans ingredients or writes.
      if (recipe !== null && !recipe.active)
        issues.push({
          code: "RECIPE_INACTIVE",
          message:
            "This recipe is not active for the selected branch and cannot be sold",
          blocking: true,
        });
      // A resolved recipe still has to be marked sellable for a direct sale.
      // The exact code match runs first, so a matching but non-sellable recipe
      // is reported here instead of looking like an unmatched code.
      if (recipe !== null && !recipe.sellable)
        issues.push({
          code: "RECIPE_NOT_SELLABLE",
          message: "This recipe is not marked as sellable",
          blocking: true,
        });

      let unitPrice: string | null = null;
      let lineTotal: string | null = null;
      // A price is only required of a recipe that is actually sold directly.
      // A matched non-sellable row is already blocked by RECIPE_NOT_SELLABLE,
      // so its missing price is not reported and no amount is computed; the
      // ingredient-only definitions used as nested children stay valid.
      if (recipe !== null && recipe.sellable && raw.quantity !== null) {
        if (recipe.sellingPrice === null || recipe.priceCurrencyCode === null) {
          issues.push({
            code: "RECIPE_UNPRICED",
            message: `Recipe ${recipe.name} has no selling price`,
            blocking: true,
          });
        } else if (currencyCode === null) {
          issues.push({
            code: "FINANCE_CURRENCY_UNKNOWN",
            message: "Set the system currency before recording priced sales",
            blocking: true,
          });
        } else if (financeIssue !== null) {
          // Already blocking; never compute a price while the finance
          // currency is unusable or differs from the fixed system currency.
        } else if (recipe.priceCurrencyCode !== currencyCode) {
          issues.push({
            code: "PRICE_CURRENCY_MISMATCH",
            message: `Recipe ${recipe.name} is priced in ${recipe.priceCurrencyCode}, but this batch records money in ${currencyCode}`,
            blocking: true,
          });
        } else {
          unitPrice = recipe.sellingPrice.toString();
          lineTotal = recipe.sellingPrice
            .mul(raw.quantity)
            .toDecimalPlaces(6)
            .toString();
        }
      }

      let requirements: IngredientPlan[] = [];
      if (recipe !== null && raw.quantity !== null && issues.length === 0) {
        try {
          requirements = SalesService.plan(recipe, recipes, raw.quantity);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Recipe cannot be sold";
          issues.push({
            code: "RECIPE_INVALID",
            message,
            blocking: true,
          });
        }
      }
      if (issues.some((issue) => issue.blocking)) blockingIssueCount += 1;
      if (channel !== null && channel.active) channelIds.add(channel.id);
      // Aggregate every row by leaf item before any shortage check, so one
      // item shared by several recipes or paths is compared once with its sum.
      for (const requirement of requirements) {
        const existing = aggregate.get(requirement.item.id);
        if (existing)
          existing.required = existing.required.add(requirement.required);
        else
          aggregate.set(requirement.item.id, {
            item: requirement.item,
            required: requirement.required,
          });
      }

      analysisRows.push({
        row: raw.row,
        excluded: false,
        included: true,
        cells: raw.cells,
        channelValue: raw.channelValue,
        productValue: raw.productValue,
        productCode: raw.productCode,
        productKey: raw.productKey,
        quantityRaw: raw.quantityRaw,
        quantity: raw.quantity,
        channelId: channel?.id ?? null,
        channelUuid: channel?.uuid ?? null,
        channelName: channel?.name ?? null,
        recipeUuid: recipe?.uuid ?? null,
        recipeName: recipe?.name ?? null,
        unitPrice,
        lineTotal,
        issues,
        recipe,
        requirements,
      });
    }

    const channelSummary = new Map<
      string,
      {
        sourceValue: string;
        channelUuid: string | null;
        channelName: string | null;
        rows: number;
        quantity: number;
      }
    >();
    const productSummary = new Map<
      string,
      {
        productKey: string;
        label: string;
        sourceCode: string | null;
        sourceText: string | null;
        recipeUuid: string | null;
        recipeName: string | null;
        rows: number;
        quantity: number;
      }
    >();
    for (const row of analysisRows) {
      if (!row.included) continue;
      if (row.channelValue !== "") {
        const existing = channelSummary.get(row.channelValue);
        if (existing) {
          existing.rows += 1;
          existing.quantity += row.quantity ?? 0;
        } else
          channelSummary.set(row.channelValue, {
            sourceValue: row.channelValue,
            channelUuid: row.channelUuid,
            channelName: row.channelName,
            rows: 1,
            quantity: row.quantity ?? 0,
          });
      }
      if (row.productKey !== null) {
        const existing = productSummary.get(row.productKey);
        if (existing) {
          existing.rows += 1;
          existing.quantity += row.quantity ?? 0;
        } else
          productSummary.set(row.productKey, {
            productKey: row.productKey,
            label: row.productValue || row.productCode,
            sourceCode: row.productKey.startsWith("code:")
              ? row.productCode
              : null,
            sourceText: row.productKey.startsWith("text:")
              ? row.productValue
              : null,
            recipeUuid: row.recipeUuid,
            recipeName: row.recipeName,
            rows: 1,
            quantity: row.quantity ?? 0,
          });
      }
    }

    const orderedAggregate = [...aggregate.values()].sort(
      (left, right) => left.item.id - right.item.id,
    );
    // Preview availability is the batch branch's exact balance, the same
    // source processing uses for its shortage check.
    const balances = await ItemStockService.balances(
      db,
      organizationId,
      config.branchId,
      orderedAggregate.map((entry) => entry.item.id),
    );
    // The same one-read aggregate decides both the requirement summary and the
    // per-row shortfall warning. Each otherwise-valid row that contributes one
    // of the short items reports it, so a shared ingredient is compared once
    // against the summed demand instead of once per row. A row that is already
    // blocking keeps only its own issues.
    const shortItemIds = new Set<number>();
    for (const { item, required } of orderedAggregate)
      if ((balances.get(item.id) ?? new Decimal(0)).lt(required))
        shortItemIds.add(item.id);
    if (shortItemIds.size > 0)
      for (const row of analysisRows) {
        if (!row.included || row.requirements.length === 0) continue;
        if (row.issues.some((issue) => issue.blocking)) continue;
        if (
          !row.requirements.some((requirement) =>
            shortItemIds.has(requirement.item.id),
          )
        )
          continue;
        row.issues.push({
          code: "STOCK_SHORTAGE",
          message:
            "This row requires ingredients with insufficient branch stock",
          blocking: true,
        });
        blockingIssueCount += 1;
      }

    return {
      configured: true,
      ...base,
      currencyCode,
      rows: analysisRows.slice(0, dataRowLimit),
      allRows: analysisRows,
      rowsTruncated: analysisRows.length > dataRowLimit,
      emptyRowCount,
      channels: [...channelSummary.values()],
      products: [...productSummary.values()],
      requirements: requirementSummary(orderedAggregate, balances),
      includedRows,
      excludedRowsCount: analysisRows.filter((row) => row.excluded).length,
      saleQuantity,
      blockingIssueCount,
      channelIds: [...channelIds],
      aggregate: orderedAggregate,
    };
  }

  private static toPreview(
    analysis: Analysis,
    branch: { uuid: string; name: string },
  ): SalesBatchesModel["preview"] {
    return {
      configured: analysis.configured,
      branch,
      sheetNames: analysis.sheetNames,
      sheetName: analysis.sheetName,
      headerRow: analysis.headerRow,
      channelColumn: analysis.channelColumn,
      productColumn: analysis.productColumn,
      quantityColumn: analysis.quantityColumn,
      productCodeColumn: analysis.productCodeColumn,
      excludedRows: analysis.excludedRows,
      modpos: analysis.modpos,
      currencyCode: analysis.currencyCode,
      grid: analysis.grid,
      gridTruncated: analysis.gridTruncated,
      rows: analysis.rows.map((row) => ({
        row: row.row,
        excluded: row.excluded,
        included: row.included,
        cells: row.cells,
        channelValue: row.channelValue,
        productValue: row.productValue,
        productCode: row.productCode,
        productKey: row.productKey,
        quantityRaw: row.quantityRaw,
        quantity: row.quantity,
        channelUuid: row.channelUuid,
        channelName: row.channelName,
        recipeUuid: row.recipeUuid,
        recipeName: row.recipeName,
        unitPrice: row.unitPrice,
        lineTotal: row.lineTotal,
        issues: row.issues,
      })),
      rowsTruncated: analysis.rowsTruncated,
      cellsTruncated: analysis.cellsTruncated,
      emptyRowCount: analysis.emptyRowCount,
      channels: analysis.channels,
      products: analysis.products,
      requirements: analysis.requirements,
      includedRows: analysis.includedRows,
      excludedRowsCount: analysis.excludedRowsCount,
      saleQuantity: analysis.saleQuantity,
      blockingIssueCount: analysis.blockingIssueCount,
    };
  }
}
