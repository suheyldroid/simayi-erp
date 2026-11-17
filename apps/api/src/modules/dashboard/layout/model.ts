import { DashboardPlain } from "../../../../prisma/generated/typebox/Dashboard";
import { resourceUuid } from "@/lib/dto";
import { t, type UnwrapSchema } from "elysia";
import { dashboardDefinitionSchema } from "../model";

const persisted = t.Pick(DashboardPlain, ["uuid", "schemaVersion", "revision"]);
const timestamps = t.Pick(DashboardPlain, ["createdAt", "updatedAt"]);

const dashboard = t.Object(
  {
    ...persisted.properties,
    uuid: t.Union([resourceUuid, t.Null()]),
    revision: t.Integer({ minimum: 0 }),
    definition: dashboardDefinitionSchema,
    savedAt: t.Union([timestamps.properties.createdAt, t.Null()]),
    updatedAt: t.Union([timestamps.properties.updatedAt, t.Null()]),
  },
  { additionalProperties: false },
);

export const DashboardLayoutModel = {
  response: t.Object({ dashboard }, { additionalProperties: false }),
  saveBody: t.Object(
    {
      expectedRevision: t.Integer({ minimum: 0 }),
      definition: dashboardDefinitionSchema,
    },
    { additionalProperties: false },
  ),
} as const;

export type DashboardLayoutResponse = UnwrapSchema<
  typeof DashboardLayoutModel.response
>;
export type DashboardSaveBody = UnwrapSchema<
  typeof DashboardLayoutModel.saveBody
>;
