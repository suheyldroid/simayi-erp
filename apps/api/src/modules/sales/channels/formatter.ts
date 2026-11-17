import type { ChannelRecord, SalesChannelsModel } from "./model";

export abstract class SalesChannelsFormatter {
  static toChannel(record: ChannelRecord): SalesChannelsModel["channel"] {
    return {
      ...record,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
