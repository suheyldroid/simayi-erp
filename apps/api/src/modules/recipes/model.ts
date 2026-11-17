import { t, type UnwrapSchema } from "elysia";
import type {
  Prisma,
  PrismaClient,
} from "../../../prisma/generated/prisma/client";
import { PartPlain } from "../../../prisma/generated/typebox/Part";
import { RecipeLinePlain } from "../../../prisma/generated/typebox/RecipeLine";
import { RecipePlain } from "../../../prisma/generated/typebox/Recipe";
import { pageQuery, resourceUuid, successBody } from "@/lib/dto";

export type Database = Prisma.TransactionClient | PrismaClient;

/** Where one effective recipe definition comes from. */
export type RecipeScope = "company" | "local" | "customized";

/**
 * The effective definition of one recipe inside a context: a company template
 * followed as-is, a branch's full customization of that template, or a recipe
 * that only exists in one branch. `key` is the stable selector identity: the
 * company root recipe id for shared definitions and the local recipe id for
 * branch-local ones.
 */
export type EffectiveRecipe = {
  key: number;
  /** Row of the definition actually used (company root, branch copy, local). */
  definitionId: number;
  /** Public selector UUID; stable across customization and reset. */
  uuid: string;
  /** Company root UUID when this definition customizes one, else null. */
  sourceUuid: string | null;
  customizationUuid: string | null;
  scope: RecipeScope;
  name: string;
  /** Exact product code of the effective definition; null when none is set. */
  code: string | null;
  description: string;
  /** Effective availability: company gate and branch activation, or local. */
  active: boolean;
  /**
   * Effective sellability of the definition used here. Independent of
   * `active`: a recipe can be available in the branch and still not sold
   * directly, while a nested ingredient recipe never has to be sellable.
   */
  sellable: boolean;
  /** Effective content version (company root, customization, or local row). */
  version: number;
  /** Owning branch of a branch-local recipe; never set for company templates. */
  branch: { uuid: string; name: string } | null;
  sellingPrice: Prisma.Decimal | null;
  priceCurrencyCode: string | null;
  sourceVersion: number | null;
  /** Current company gate for shared definitions; local recipe's own gate. */
  sourceActive: boolean;
  /** Branch preference; absent rows resolve to active with version 0. */
  activation: { active: boolean; version: number } | null;
  ingredientCount: number;
  createdAt: Date;
  updatedAt: Date;
  lines: readonly EffectiveRecipeLine[];
};

export type EffectiveRecipeLine = Omit<RecipeLineRecord, "childRecipeId"> & {
  /** Canonical child identity inside this context, or null for an item line. */
  childRecipeId: number | null;
};

/** Ingredient item metadata. Stock lives in the branch balance, never here. */
export const effectiveItemSelect = {
  id: true,
  uuid: true,
  name: true,
  ipn: true,
  active: true,
  unit: { select: { code: true } },
} satisfies Prisma.PartSelect;

export const effectiveLineSelect = {
  id: true,
  uuid: true,
  itemId: true,
  childRecipeId: true,
  quantity: true,
  note: true,
  item: { select: effectiveItemSelect },
} satisfies Prisma.RecipeLineSelect;

export const effectiveRecipeSelect = {
  id: true,
  uuid: true,
  name: true,
  code: true,
  description: true,
  active: true,
  sellable: true,
  version: true,
  sellingPrice: true,
  priceCurrencyCode: true,
  branchId: true,
  branch: { select: { uuid: true, name: true } },
  sourceRecipeId: true,
  sourceVersion: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { ingredients: true } },
  ingredients: { select: effectiveLineSelect, orderBy: { id: "asc" } },
} satisfies Prisma.RecipeSelect;

export type RecipeRecord = Prisma.RecipeGetPayload<{
  select: typeof effectiveRecipeSelect;
}>;
export type RecipeLineRecord = RecipeRecord["ingredients"][number];
export type EffectiveItem = NonNullable<RecipeLineRecord["item"]>;

const queryFlag = t.Optional(
  t.Union([t.Boolean(), t.Literal("true"), t.Literal("false")]),
);
const queryVersion = t.Numeric({
  minimum: 0,
  maximum: 2147483647,
  multipleOf: 1,
});
// Recipe amounts are exact decimal strings over HTTP; Prismabox types Decimal
// as Number. Zero and negative values are rejected before they reach the
// database.
const quantity = t.String({
  pattern: "^(?!0+(?:\\.0+)?$)\\d+(?:\\.\\d{1,5})?$",
  maxLength: 20,
});
// A nonnegative price at DECIMAL(19,6) precision. Null clears the price; an
// omitted value keeps the current price.
const sellingPrice = t.String({
  pattern: "^\\d{1,13}(?:\\.\\d{1,6})?$",
  maxLength: 20,
});
const name = {
  ...RecipePlain.properties.name,
  minLength: 1,
  maxLength: 100,
};
// The generated nullable `RecipePlain.code` supplies the description and the
// null member; only the database's 100-character limit is added to its string
// member. The field stays required and nullable in responses.
const code = t.Union([
  t.Null(),
  t.String({ ...RecipePlain.properties.code.anyOf[1], maxLength: 100 }),
]);
const description = {
  ...RecipePlain.properties.description,
  maxLength: 250,
};
const active = RecipePlain.properties.active;
// Direct sellability. The generated boolean schema is reused so the optional
// write fields, the response fields and the database column stay one type.
const sellable = RecipePlain.properties.sellable;
const bodyVersion = {
  ...RecipePlain.properties.version,
  minimum: 0,
  maximum: 2147483647,
};
const note = { ...RecipeLinePlain.properties.note, maxLength: 500 };

const ingredientItem = t.Object(
  {
    ...t.Pick(PartPlain, ["name", "ipn"]).properties,
    uuid: resourceUuid,
    units: t.String(),
  },
  { additionalProperties: false },
);

const scope = t.Union([
  t.Literal("company"),
  t.Literal("local"),
  t.Literal("customized"),
]);

const activation = t.Object(
  {
    active: t.Boolean({
      description:
        "Branch preference, defaulting to true without a stored activation; effective availability also requires an active company recipe.",
    }),
    version: t.Integer({
      minimum: 0,
      description:
        "Activation version for optimistic concurrency; 0 when no activation row exists.",
    }),
  },
  { additionalProperties: false },
);

const summary = t.Object(
  {
    uuid: resourceUuid,
    scope,
    name: { ...RecipePlain.properties.name, maxLength: 100 },
    code,
    description: { ...RecipePlain.properties.description, maxLength: 250 },
    /** Owning branch label; null for a company template in company context. */
    branch: t.Nullable(
      t.Object(
        {
          uuid: resourceUuid,
          name: t.String({ minLength: 1, maxLength: 100 }),
        },
        { additionalProperties: false },
      ),
    ),
    sellingPrice: t.Nullable(t.String()),
    priceCurrencyCode: t.Nullable(t.String({ pattern: "^[A-Z]{3}$" })),
    active: t.Boolean(),
    sellable,
    version: t.Integer({ minimum: 0 }),
    sourceRecipeUuid: t.Nullable(resourceUuid),
    sourceVersion: t.Nullable(t.Integer({ minimum: 0 })),
    sourceRecipeActive: t.Boolean(),
    customizationUuid: t.Nullable(resourceUuid),
    activation: t.Nullable(activation),
    ingredientCount: t.Integer({ minimum: 0 }),
    createdAt: RecipePlain.properties.createdAt,
    updatedAt: RecipePlain.properties.updatedAt,
  },
  { additionalProperties: false },
);

const ingredientBase = {
  uuid: resourceUuid,
  quantity: t.String(),
  note: t.String(),
};

const ingredient = t.Union([
  t.Object(
    {
      ...ingredientBase,
      kind: t.Literal("item"),
      itemUuid: resourceUuid,
      item: ingredientItem,
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      ...ingredientBase,
      kind: t.Literal("recipe"),
      recipeUuid: resourceUuid,
      recipe: summary,
    },
    { additionalProperties: false },
  ),
]);

// Exactly one reference per row; the strict branch objects reject a body that
// accidentally sends both or neither.
const ingredientInput = t.Union([
  t.Object(
    {
      kind: t.Literal("item"),
      itemUuid: resourceUuid,
      quantity,
      note: t.Optional(note),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      kind: t.Literal("recipe"),
      recipeUuid: resourceUuid,
      quantity,
      note: t.Optional(note),
    },
    { additionalProperties: false },
  ),
]);

const detail = t.Object(
  {
    ...summary.properties,
    ingredients: t.Array(ingredient),
  },
  { additionalProperties: false },
);

export const RecipesModel = {
  params: t.Object({ recipeUuid: resourceUuid }),
  query: t.Object({
    ...pageQuery.properties,
    active: queryFlag,
    /**
     * Keep only definitions marked sellable. A direct-sale picker sends
     * `true`; an ingredient picker omits the filter because a nested recipe
     * never has to be sellable.
     */
    sellable: queryFlag,
    /**
     * Canonical company templates only. The company-template ingredient picker
     * passes this so the broadened company catalog can never offer a
     * branch-local recipe as a nested child.
     */
    templates: queryFlag,
  }),
  deleteQuery: t.Object({ version: queryVersion }),
  body: t.Object(
    {
      name,
      code: t.Optional(code),
      description: t.Optional(description),
      active: t.Optional(active),
      sellable: t.Optional(sellable),
      sellingPrice: t.Optional(t.Nullable(sellingPrice)),
      ingredients: t.Array(ingredientInput, { minItems: 1, maxItems: 500 }),
    },
    { additionalProperties: false },
  ),
  patch: t.Object(
    {
      version: bodyVersion,
      // Required when the effective definition is a branch customization: the
      // stable recipe selector cannot identify a copy that was reset and
      // recreated between two requests.
      customizationUuid: t.Optional(resourceUuid),
      name: t.Optional(name),
      code: t.Optional(code),
      description: t.Optional(description),
      active: t.Optional(active),
      sellable: t.Optional(sellable),
      sellingPrice: t.Optional(t.Nullable(sellingPrice)),
      ingredients: t.Optional(
        t.Array(ingredientInput, { minItems: 1, maxItems: 500 }),
      ),
    },
    { additionalProperties: false },
  ),
  activation,
  customize: t.Object(
    {
      sourceVersion: t.Integer({ minimum: 0, maximum: 2147483647 }),
      name: t.Optional(name),
      code: t.Optional(code),
      description: t.Optional(description),
      sellable: t.Optional(sellable),
      sellingPrice: t.Optional(t.Nullable(sellingPrice)),
      ingredients: t.Optional(
        t.Array(ingredientInput, { minItems: 1, maxItems: 500 }),
      ),
    },
    { additionalProperties: false },
  ),
  reset: t.Object(
    {
      version: t.Integer({ minimum: 0, maximum: 2147483647 }),
      customizationUuid: resourceUuid,
    },
    { additionalProperties: false },
  ),
  summary,
  detail,
  list: t.Object({
    items: t.Array(summary),
    total: t.Integer(),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
  success: successBody,
} as const;
export type RecipesModel = {
  [K in keyof typeof RecipesModel]: UnwrapSchema<(typeof RecipesModel)[K]>;
};
