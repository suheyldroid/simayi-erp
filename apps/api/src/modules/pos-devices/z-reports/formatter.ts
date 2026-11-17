import type { ZReportRecord, PosDeviceZReportsModel } from "./model";

export abstract class PosDeviceZReportsFormatter {
  static toReport(record: ZReportRecord): PosDeviceZReportsModel["report"] {
    return {
      uuid: record.uuid,
      reportNumber: record.reportNumber,
      businessDate: record.businessDate.toISOString().slice(0, 10),
      closedAt: record.closedAt.toISOString(),
      totalAmount: record.totalAmount.toString(),
      currencyCode: record.currencyCode,
      note: record.note,
      version: record.version,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      posDevice: {
        uuid: record.posDevice.uuid,
        name: record.posDevice.name,
      },
      branch: {
        uuid: record.posDevice.branch.uuid,
        name: record.posDevice.branch.name,
        active: record.posDevice.branch.active,
      },
      salesBatch: record.salesBatch
        ? {
            ...record.salesBatch,
            businessDate: record.salesBatch.businessDate
              .toISOString()
              .slice(0, 10),
          }
        : null,
    };
  }
}
