import { t, type UnwrapSchema } from "elysia";
import { successBody } from "@/lib/dto";

// Prismabox renders Prisma Decimal as Number and day-only columns as ISO
// date-time strings; the HTTP contract keeps exact decimal strings and
// YYYY-MM-DD calendar dates, so these are explicit transport overrides.
export const OrderModel = {
  version: t.Integer({ minimum: 0 }),
  versionBody: t.Object(
    { version: t.Integer({ minimum: 0 }) },
    { additionalProperties: false },
  ),
  amount: t.String({ pattern: "^\\d+(?:\\.\\d{1,5})?$", maxLength: 20 }),
  price: t.String({ pattern: "^\\d+(?:\\.\\d{1,6})?$", maxLength: 20 }),
  discount: t.String({ pattern: "^\\d+(?:\\.\\d{1,2})?$", maxLength: 6 }),
  day: t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
  jsonObject: t.Nullable(t.Record(t.String(), t.Unknown())),
  success: successBody,
} as const;
export type OrderModel = {
  [K in keyof typeof OrderModel]: UnwrapSchema<(typeof OrderModel)[K]>;
};
