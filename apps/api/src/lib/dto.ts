import { t, type UnwrapSchema } from "elysia";

/**
 * Public resource identity is a UUID string. Internal integer primary keys are
 * never accepted or exposed at the HTTP boundary.
 */
export const resourceUuid = t.String({ format: "uuid" });
export const resourceParams = t.Object({ uuid: resourceUuid });
export const pageQuery = t.Object({
  limit: t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1, default: 50 }),
  offset: t.Numeric({
    minimum: 0,
    maximum: 2147483647,
    multipleOf: 1,
    default: 0,
  }),
  search: t.Optional(t.String({ maxLength: 100 })),
});
export const successBody = t.Object({ success: t.Literal(true) });

export type PageQuery = UnwrapSchema<typeof pageQuery>;
