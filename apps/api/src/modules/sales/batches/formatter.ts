import type {
  BatchDetailRecord,
  BatchSummaryRecord,
  SalesBatchesModel,
} from "./model";

function day(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export abstract class SalesBatchesFormatter {
  static toSummary(record: BatchSummaryRecord): SalesBatchesModel["summary"] {
    const channels = new Map<string, { uuid: string; name: string }>();
    for (const mapping of record.channels) {
      // A null channel is a deliberate batch-local unmapped override, not a
      // summary channel.
      if (mapping.channel === null) continue;
      channels.set(mapping.channel.uuid, {
        uuid: mapping.channel.uuid,
        name: mapping.channel.name,
      });
    }
    return {
      uuid: record.uuid,
      reference: record.reference,
      referenceInt: record.referenceInt.toString(),
      businessDate: day(record.businessDate),
      status: record.status,
      sourceFileName: record.sourceFileName,
      sourceFileSize: record.sourceFileSize,
      rowCount: record.rowCount,
      quantityTotal: record.quantityTotal,
      channelCount: record.channelCount,
      processedAt: record.processedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      createdById: record.createdById,
      createdByName: record.createdByName,
      branch: { uuid: record.branch.uuid, name: record.branch.name },
      channels: [...channels.values()],
    };
  }

  static toDetail(record: BatchDetailRecord): SalesBatchesModel["detail"] {
    return {
      ...SalesBatchesFormatter.toSummary(record),
      sheetNames: record.sheetNames,
      sheetName: record.sheetName,
      headerRow: record.headerRow,
      channelColumn: record.channelColumn,
      productColumn: record.productColumn,
      quantityColumn: record.quantityColumn,
      productCodeColumn: record.productCodeColumn,
      excludedRows: record.excludedRows,
      sales: record.builds.map((sale) => ({
        uuid: sale.uuid,
        reference: sale.reference,
        recipeName: sale.recipeName,
        quantity: sale.quantity,
        sourceRow: sale.sourceRow,
        channel: sale.channel,
      })),
    };
  }
}
