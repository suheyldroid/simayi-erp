import type { BranchRecord, BranchesModel } from "./model";

export abstract class BranchesFormatter {
  static toBranch(record: BranchRecord): BranchesModel["branch"] {
    return {
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
