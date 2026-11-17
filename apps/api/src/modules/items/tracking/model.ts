import { t, type UnwrapSchema } from "elysia";
import type { Prisma } from "../../../../prisma/generated/prisma/client";
import { ItemTrackingPlain } from "../../../../prisma/generated/typebox/ItemTracking";
import { pageQuery, resourceParams, resourceUuid } from "@/lib/dto";

// Query projection used by the service; the organization column stays in the
// tenant where-clause and the nullable item relation supplies itemUuid.
export const trackingSelect = {
  uuid: true,
  trackingType: true,
  date: true,
  notes: true,
  userId: true,
  deltas: true,
  quantityBefore: true,
  quantityAfter: true,
  unitCode: true,
  item: { select: { uuid: true } },
  branch: { select: { uuid: true } },
} satisfies Prisma.ItemTrackingSelect;
export type TrackingRecord = Prisma.ItemTrackingGetPayload<{
  select: typeof trackingSelect;
}>;

const entryBase = t.Pick(ItemTrackingPlain, [
  "trackingType",
  "date",
  "notes",
  "userId",
]);

const entry = t.Object(
  {
    ...entryBase.properties,
    uuid: resourceUuid,
    itemUuid: t.Nullable(resourceUuid),
    branchUuid: resourceUuid,
    trackingType: { ...entryBase.properties.trackingType, minimum: 0 },
    // Deltas are a JSON object in the API contract, not arbitrary Prisma JSON.
    deltas: t.Nullable(t.Record(t.String(), t.Unknown())),
    quantityBefore: t.Nullable(t.String()),
    quantityAfter: t.Nullable(t.String()),
    // Unit snapshot at the time of the movement; null means unknown legacy row.
    unitCode: t.Nullable(t.String({ maxLength: 20 })),
  },
  { additionalProperties: false },
);

export const TrackingModel = {
  params: resourceParams,
  query: pageQuery,
  entry,
  list: t.Object({
    items: t.Array(entry),
    total: t.Integer(),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
} as const;
export type TrackingModel = {
  [K in keyof typeof TrackingModel]: UnwrapSchema<(typeof TrackingModel)[K]>;
};
