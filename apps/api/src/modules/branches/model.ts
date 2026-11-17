import { t, type UnwrapSchema } from "elysia";
import type { Prisma } from "../../../prisma/generated/prisma/client";
import { BranchPlain } from "../../../prisma/generated/typebox/Branch";
import { pageQuery, resourceUuid } from "@/lib/dto";

const queryFlag = t.Optional(
  t.Union([t.Boolean(), t.Literal("true"), t.Literal("false")]),
);

const name = {
  ...BranchPlain.properties.name,
  minLength: 1,
  maxLength: 100,
  pattern: "\\S",
};

const description = {
  ...BranchPlain.properties.description,
  maxLength: 250,
};

const version = {
  ...BranchPlain.properties.version,
  minimum: 0,
};

/** Presentation columns; the internal integer id never leaves the service. */
export const branchColumns = {
  uuid: true,
  name: true,
  description: true,
  active: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BranchSelect;

export type BranchRecord = Prisma.BranchGetPayload<{
  select: typeof branchColumns;
}>;

const branch = t.Object(
  {
    uuid: resourceUuid,
    name,
    description,
    active: BranchPlain.properties.active,
    version,
    createdAt: BranchPlain.properties.createdAt,
    updatedAt: BranchPlain.properties.updatedAt,
  },
  { additionalProperties: false },
);

export const BranchesModel = {
  params: t.Object(
    { branchUuid: resourceUuid },
    { additionalProperties: false },
  ),
  query: t.Object({
    ...pageQuery.properties,
    active: queryFlag,
  }),
  body: t.Object(
    {
      name,
      description: t.Optional(description),
    },
    { additionalProperties: false },
  ),
  patch: t.Object(
    {
      name: t.Optional(name),
      description: t.Optional(description),
      active: t.Optional(BranchPlain.properties.active),
      version,
    },
    { additionalProperties: false },
  ),
  branch,
  list: t.Object({
    items: t.Array(branch),
    total: t.Integer({ minimum: 0 }),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
} as const;
export type BranchesModel = {
  [K in keyof typeof BranchesModel]: UnwrapSchema<(typeof BranchesModel)[K]>;
};
