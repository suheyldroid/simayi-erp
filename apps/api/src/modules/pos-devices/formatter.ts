import type { PosDeviceRecord, PosDevicesModel } from "./model";

export abstract class PosDevicesFormatter {
  static toDevice(record: PosDeviceRecord): PosDevicesModel["device"] {
    return {
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
