import { t, type UnwrapSchema } from "elysia";
import type { Prisma } from "../../../prisma/generated/prisma/client";
import { PartCategoryPlain } from "../../../prisma/generated/typebox/PartCategory";
import {
  pageQuery,
  resourceParams,
  resourceUuid,
  successBody,
} from "@/lib/dto";

const queryFlag = t.Optional(
  t.Union([t.Boolean(), t.Literal("true"), t.Literal("false")]),
);

/** Presentation columns aligned with the response and formatter. */
export const categoryColumns = {
  id: true,
  uuid: true,
  name: true,
  description: true,
  parentId: true,
  parent: { select: { uuid: true } },
  pathstring: true,
  structural: true,
  defaultKeywords: true,
  icon: true,
  _count: { select: { children: true, parts: true } },
} as const satisfies Prisma.PartCategorySelect;

export type CategoryRecord = Prisma.PartCategoryGetPayload<{
  select: typeof categoryColumns;
}>;

const editable = t.Omit(
  PartCategoryPlain,
  ["id", "organizationId", "pathstring", "uuid", "parentId"],
  { additionalProperties: false },
);

const category = t.Object(
  {
    uuid: resourceUuid,
    name: {
      ...editable.properties.name,
      minLength: 1,
      maxLength: 100,
      pattern: "\\S",
    },
    description: {
      ...editable.properties.description,
      maxLength: 250,
      default: "",
    },
    parentUuid: t.Nullable(resourceUuid),
    pathstring: { ...PartCategoryPlain.properties.pathstring, maxLength: 250 },
    structural: { ...editable.properties.structural, default: false },
    defaultKeywords: t.Nullable(t.String({ maxLength: 250 })),
    icon: t.Nullable(t.String({ maxLength: 100 })),
    childCount: t.Integer({ minimum: 0 }),
    itemCount: t.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const ItemCategoriesModel = {
  query: t.Object({
    ...pageQuery.properties,
    parentUuid: t.Optional(resourceUuid),
    roots: queryFlag,
    structural: queryFlag,
  }),
  params: resourceParams,
  body: t.Object(
    {
      name: {
        ...editable.properties.name,
        minLength: 1,
        maxLength: 100,
        pattern: "\\S",
      },
      description: {
        ...editable.properties.description,
        maxLength: 250,
        default: "",
      },
      parentUuid: t.Optional(t.Nullable(resourceUuid)),
      structural: { ...editable.properties.structural, default: false },
      defaultKeywords: t.Optional(t.Nullable(t.String({ maxLength: 250 }))),
      icon: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
    },
    { additionalProperties: false },
  ),
  patch: t.Partial(
    t.Object(
      {
        name: {
          ...editable.properties.name,
          minLength: 1,
          maxLength: 100,
          pattern: "\\S",
        },
        description: { ...editable.properties.description, maxLength: 250 },
        parentUuid: t.Nullable(resourceUuid),
        structural: editable.properties.structural,
        defaultKeywords: t.Nullable(t.String({ maxLength: 250 })),
        icon: t.Nullable(t.String({ maxLength: 100 })),
      },
      { additionalProperties: false },
    ),
  ),
  category,
  list: t.Object({
    items: t.Array(category),
    total: t.Integer(),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
  success: successBody,
} as const;
export type ItemCategoriesModel = {
  [K in keyof typeof ItemCategoriesModel]: UnwrapSchema<
    (typeof ItemCategoriesModel)[K]
  >;
};
