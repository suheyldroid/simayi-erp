import { createHash } from "node:crypto";
import { MediaService } from "@/lib/media";
import {
  imageContentTypes,
  verifyImageBytes,
  type ImageKind,
  type VerifiedImage,
} from "@/lib/images";
import { logError } from "@/lib/logger";
import { disconnectPrisma, prisma } from "@/lib/prisma";
import {
  mediaPurpose,
  mediaStatus,
  type ImagePurpose,
} from "@/modules/media/model";
import { MediaFilesService } from "@/modules/media/service";
import { workbookMaxBytes } from "@/modules/sales/batches/workbook";

/**
 * Explicit, idempotent operational backfill for files created before the
 * central media module.
 *
 *   bun run media:backfill-consumers --dry-run
 *   bun run media:backfill-consumers --batch 200
 *
 * Pages every item, supplier, and sales batch to exhaustion. Existing
 * `Item.image`, `Supplier.image`, and `SalesBatch.sourceFile` references are
 * preserved; this only indexes the already stored bytes in `media_file` with
 * their legacy private storage keys and single-target bindings
 * (`item:<uuid>` / `supplier:<uuid>` / `sales-batch:<uuid>`). Missing or
 * invalid files fail loudly and are never dropped; remote URLs and data URIs
 * are counted as preserved historical values and are never fetched. A second
 * run reports the same rows as already indexed. The API must not be writing
 * while this runs: that is a deployment precondition, because the script
 * cannot atomically prove a reference did not change under a live writer.
 * Failure output contains record identities and fixed reasons only, never
 * storage paths.
 */
const itemReference =
  /^\/items\/images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(png|jpg|webp)$/;
const supplierReference =
  /^\/supplier\/images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(png|jpg|webp)$/;
const workbookFile =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.xlsx$/;
const bareWorkbookUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const externalReference = /^(?:https?:\/\/|data:)/i;
const xlsxContentType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type Failure = { kind: string; id: string; reason: string };

function batchArgument(): number {
  const index = process.argv.indexOf("--batch");
  if (index === -1) return 200;
  const parsed = Number(process.argv[index + 1]);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000)
    throw new Error("--batch must be an integer between 1 and 1000");
  return parsed;
}

function tenantDirectory(organizationId: string): string {
  return createHash("sha256").update(organizationId).digest("hex");
}

function failureReason(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const dryRun = process.argv.includes("--dry-run");

try {
  const batch = batchArgument();
  const failures: Failure[] = [];
  const counts = {
    itemsIndexed: 0,
    suppliersIndexed: 0,
    workbooksIndexed: 0,
    wouldIndex: 0,
    alreadyIndexed: 0,
    external: 0,
    empty: 0,
  };

  async function imageRow(input: {
    kind: string;
    id: string;
    organizationId: string;
    targetUuid: string;
    uuid: string;
    extension: ImageKind;
    purpose: ImagePurpose;
    directory: string;
  }): Promise<void> {
    const storageKey = `${input.directory}/${tenantDirectory(input.organizationId)}/${input.uuid}.${input.extension}`;
    const binding = MediaFilesService.imageBinding(
      input.purpose,
      input.targetUuid,
    );
    const existing = await prisma.mediaFile.findUnique({
      where: { uuid: input.uuid },
      select: {
        organizationId: true,
        purpose: true,
        reference: true,
        status: true,
        contentType: true,
        storageKey: true,
      },
    });
    if (existing !== null) {
      if (
        existing.organizationId === input.organizationId &&
        existing.purpose === input.purpose &&
        existing.reference === binding &&
        existing.status === mediaStatus.attached &&
        existing.contentType === imageContentTypes[input.extension] &&
        existing.storageKey.endsWith(`.${input.extension}`)
      ) {
        counts.alreadyIndexed += 1;
        return;
      }
      failures.push({
        kind: input.kind,
        id: input.id,
        reason:
          existing.purpose === input.purpose &&
          existing.organizationId === input.organizationId
            ? "stored file is shared by more than one record"
            : "stored file identity belongs to a different media row",
      });
      return;
    }
    const occupied = await prisma.mediaFile.findFirst({
      where: {
        organizationId: input.organizationId,
        purpose: input.purpose,
        reference: binding,
      },
      select: { id: true },
    });
    if (occupied !== null) {
      failures.push({
        kind: input.kind,
        id: input.id,
        reason: "binding is already used by another stored file",
      });
      return;
    }
    let bytes: Uint8Array;
    try {
      bytes = await MediaService.read(storageKey);
    } catch {
      failures.push({
        kind: input.kind,
        id: input.id,
        reason: "missing or unreadable stored image",
      });
      return;
    }
    let image: VerifiedImage;
    try {
      image = verifyImageBytes(bytes);
    } catch (error) {
      failures.push({
        kind: input.kind,
        id: input.id,
        reason: failureReason(error, "invalid stored image"),
      });
      return;
    }
    if (image.kind !== input.extension) {
      failures.push({
        kind: input.kind,
        id: input.id,
        reason: "stored image content does not match its reference extension",
      });
      return;
    }
    if (dryRun) {
      counts.wouldIndex += 1;
      return;
    }
    try {
      await MediaFilesService.importAttached({
        uuid: input.uuid,
        organizationId: input.organizationId,
        purpose: input.purpose,
        reference: binding,
        storageKey,
        originalName: `${input.uuid}.${input.extension}`,
        contentType: image.contentType,
        byteSize: image.bytes.length,
      });
      if (input.purpose === mediaPurpose.itemImage) counts.itemsIndexed += 1;
      else counts.suppliersIndexed += 1;
    } catch {
      failures.push({
        kind: input.kind,
        id: input.id,
        reason: "could not create the media row",
      });
    }
  }

  let cursor = 0;
  for (;;) {
    const items = await prisma.part.findMany({
      where: { id: { gt: cursor }, image: { not: null } },
      select: { id: true, uuid: true, organizationId: true, image: true },
      orderBy: { id: "asc" },
      take: batch,
    });
    const lastItem = items.at(-1);
    if (!lastItem) break;
    cursor = lastItem.id;
    for (const item of items) {
      const image = item.image;
      if (image === null || image === "") {
        counts.empty += 1;
        continue;
      }
      if (externalReference.test(image)) {
        counts.external += 1;
        continue;
      }
      const match = itemReference.exec(image);
      if (!match)
        failures.push({
          kind: "item",
          id: item.uuid,
          reason: "unsupported image reference",
        });
      else
        await imageRow({
          kind: "item",
          id: item.uuid,
          organizationId: item.organizationId,
          targetUuid: item.uuid,
          uuid: match[1] ?? "",
          extension: match[2] as ImageKind,
          purpose: mediaPurpose.itemImage,
          directory: "items/images",
        });
    }
    if (items.length < batch) break;
  }

  cursor = 0;
  for (;;) {
    const suppliers = await prisma.supplier.findMany({
      where: { id: { gt: cursor }, image: { not: null } },
      select: { id: true, uuid: true, organizationId: true, image: true },
      orderBy: { id: "asc" },
      take: batch,
    });
    const lastSupplier = suppliers.at(-1);
    if (!lastSupplier) break;
    cursor = lastSupplier.id;
    for (const supplier of suppliers) {
      const image = supplier.image;
      if (image === null || image === "") {
        counts.empty += 1;
        continue;
      }
      if (externalReference.test(image)) {
        counts.external += 1;
        continue;
      }
      const match = supplierReference.exec(image);
      if (!match)
        failures.push({
          kind: "supplier",
          id: supplier.uuid,
          reason: "unsupported image reference",
        });
      else
        await imageRow({
          kind: "supplier",
          id: supplier.uuid,
          organizationId: supplier.organizationId,
          targetUuid: supplier.uuid,
          uuid: match[1] ?? "",
          extension: match[2] as ImageKind,
          purpose: mediaPurpose.supplierImage,
          directory: "supplier/images",
        });
    }
    if (suppliers.length < batch) break;
  }

  cursor = 0;
  for (;;) {
    const batches = await prisma.salesBatch.findMany({
      where: { id: { gt: cursor } },
      select: {
        id: true,
        uuid: true,
        organizationId: true,
        sourceFile: true,
        sourceFileName: true,
        sourceFileSize: true,
      },
      orderBy: { id: "asc" },
      take: batch,
    });
    const lastBatch = batches.at(-1);
    if (!lastBatch) break;
    cursor = lastBatch.id;
    for (const salesBatch of batches) {
      const reference = `sales-batch:${salesBatch.uuid}`;
      const legacyMatch = workbookFile.exec(salesBatch.sourceFile);
      const legacyUuid = legacyMatch?.[1] ?? null;
      const expectedUuid =
        legacyUuid ??
        (bareWorkbookUuid.test(salesBatch.sourceFile)
          ? salesBatch.sourceFile
          : null);
      if (expectedUuid === null) {
        failures.push({
          kind: "sales-batch",
          id: salesBatch.uuid,
          reason: "unsupported source file name",
        });
        continue;
      }
      const existing = await prisma.mediaFile.findFirst({
        where: {
          organizationId: salesBatch.organizationId,
          purpose: mediaPurpose.salesWorkbook,
          reference,
        },
        select: {
          uuid: true,
          status: true,
          contentType: true,
          storageKey: true,
        },
      });
      if (existing !== null) {
        if (
          existing.uuid === expectedUuid &&
          existing.status === mediaStatus.attached &&
          existing.contentType === xlsxContentType &&
          existing.storageKey.endsWith(".xlsx")
        ) {
          counts.alreadyIndexed += 1;
          continue;
        }
        failures.push({
          kind: "sales-batch",
          id: salesBatch.uuid,
          reason: "stored workbook identity belongs to a different media row",
        });
        continue;
      }
      if (!legacyMatch) {
        failures.push({
          kind: "sales-batch",
          id: salesBatch.uuid,
          reason: "source file has no media row",
        });
        continue;
      }
      const storageKey = `sales/batches/${tenantDirectory(salesBatch.organizationId)}/${salesBatch.sourceFile}`;
      let bytes: Uint8Array;
      try {
        bytes = await MediaService.read(storageKey);
      } catch {
        failures.push({
          kind: "sales-batch",
          id: salesBatch.uuid,
          reason: "missing or unreadable stored workbook",
        });
        continue;
      }
      if (
        bytes.length === 0 ||
        bytes.length > workbookMaxBytes ||
        bytes.length !== salesBatch.sourceFileSize ||
        bytes[0] !== 0x50 ||
        bytes[1] !== 0x4b
      ) {
        failures.push({
          kind: "sales-batch",
          id: salesBatch.uuid,
          reason: "stored workbook is empty, oversized, truncated, or not xlsx",
        });
        continue;
      }
      if (dryRun) {
        counts.wouldIndex += 1;
        continue;
      }
      try {
        await MediaFilesService.importAttached({
          uuid: expectedUuid,
          organizationId: salesBatch.organizationId,
          purpose: mediaPurpose.salesWorkbook,
          reference,
          storageKey,
          originalName: salesBatch.sourceFileName,
          contentType: xlsxContentType,
          byteSize: bytes.length,
        });
        counts.workbooksIndexed += 1;
      } catch {
        failures.push({
          kind: "sales-batch",
          id: salesBatch.uuid,
          reason: "could not create the media row",
        });
      }
    }
    if (batches.length < batch) break;
  }

  process.stdout.write(
    `${JSON.stringify({ dryRun, batch, ...counts, failures: failures.length })}\n`,
  );
  for (const failure of failures)
    process.stderr.write(
      `${JSON.stringify({ level: "error", message: "media backfill failed", ...failure })}\n`,
    );
  if (failures.length > 0) process.exitCode = 1;
} catch (error) {
  logError(error);
  process.exitCode = 1;
} finally {
  await disconnectPrisma();
}
