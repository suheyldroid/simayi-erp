import { t, type UnwrapSchema } from "elysia";
import type { Prisma } from "../../../prisma/generated/prisma/client";
import { UnitPlain } from "../../../prisma/generated/typebox/Unit";
import {
  pageQuery,
  resourceParams,
  resourceUuid,
  successBody,
} from "@/lib/dto";

const queryFlag = t.Optional(
  t.Union([t.Boolean(), t.Literal("true"), t.Literal("false")]),
);

const name = {
  ...UnitPlain.properties.name,
  minLength: 1,
  maxLength: 100,
  pattern: "\\S",
};

const code = {
  ...UnitPlain.properties.code,
  minLength: 1,
  maxLength: 20,
  pattern: "\\S",
};

/** Presentation columns; the internal integer id never leaves the service. */
export const unitColumns = {
  uuid: true,
  name: true,
  code: true,
  active: true,
  divisible: true,
  version: true,
} as const satisfies Prisma.UnitSelect;

export type UnitRecord = Prisma.UnitGetPayload<{ select: typeof unitColumns }>;

const unit = t.Object(
  {
    uuid: resourceUuid,
    name,
    code,
    active: UnitPlain.properties.active,
    divisible: UnitPlain.properties.divisible,
    version: { ...UnitPlain.properties.version, minimum: 0 },
  },
  { additionalProperties: false },
);

export const UnitsModel = {
  params: resourceParams,
  query: t.Object({
    ...pageQuery.properties,
    active: queryFlag,
  }),
  body: t.Object(
    {
      name,
      code,
      active: t.Optional(UnitPlain.properties.active),
      divisible: t.Optional(UnitPlain.properties.divisible),
    },
    { additionalProperties: false },
  ),
  patch: t.Object(
    {
      version: { ...UnitPlain.properties.version, minimum: 0 },
      name: t.Optional(name),
      code: t.Optional(code),
      active: t.Optional(UnitPlain.properties.active),
      divisible: t.Optional(UnitPlain.properties.divisible),
    },
    { additionalProperties: false },
  ),
  unit,
  list: t.Object({
    items: t.Array(unit),
    total: t.Integer(),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
  success: successBody,
} as const;
export type UnitsModel = {
  [K in keyof typeof UnitsModel]: UnwrapSchema<(typeof UnitsModel)[K]>;
};
