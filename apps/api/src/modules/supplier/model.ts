import { t, type UnwrapSchema } from "elysia";
import type {
  Prisma,
  PrismaClient,
  Supplier,
} from "../../../prisma/generated/prisma/client";
import { SupplierPlain } from "../../../prisma/generated/typebox/Supplier";
import {
  pageQuery,
  resourceParams,
  resourceUuid,
  successBody,
} from "@/lib/dto";

const queryFlag = t.Optional(
  t.Union([t.Boolean(), t.Literal("true"), t.Literal("false")]),
);

const editable = t.Omit(SupplierPlain, ["id", "organizationId"], {
  additionalProperties: false,
});

/** Generated property types, refined only by HTTP transport constraints. */
const constraints = {
  name: {
    ...editable.properties.name,
    minLength: 1,
    maxLength: 100,
    pattern: "\\S",
  },
  description: {
    ...editable.properties.description,
    minLength: 1,
    maxLength: 500,
    pattern: "\\S",
  },
  phone: { ...editable.properties.phone, maxLength: 50 },
  contact: { ...editable.properties.contact, maxLength: 100 },
  contactPhone: { ...editable.properties.contactPhone, maxLength: 100 },
  contactRole: { ...editable.properties.contactRole, maxLength: 100 },
  // Generated image is a nullable string union; only the length is HTTP-only.
  image: t.Nullable(t.String({ maxLength: 100 })),
  active: editable.properties.active,
  taxId: { ...editable.properties.taxId, maxLength: 50 },
  line1: { ...editable.properties.line1, maxLength: 50 },
  line2: { ...editable.properties.line2, maxLength: 50 },
  postalCode: { ...editable.properties.postalCode, maxLength: 10 },
  postalCity: { ...editable.properties.postalCity, maxLength: 50 },
  province: { ...editable.properties.province, maxLength: 50 },
  country: { ...editable.properties.country, maxLength: 50 },
  shippingNotes: { ...editable.properties.shippingNotes, maxLength: 100 },
  internalShippingNotes: {
    ...editable.properties.internalShippingNotes,
    maxLength: 100,
  },
  addressLink: { ...editable.properties.addressLink, maxLength: 2000 },
};

/** Published and create fields keep the original defaults and bounds. */
const fields = {
  ...constraints,
  phone: { ...constraints.phone, default: "" },
  contact: { ...constraints.contact, default: "" },
  contactPhone: { ...constraints.contactPhone, default: "" },
  contactRole: { ...constraints.contactRole, default: "" },
  active: { ...constraints.active, default: true },
  taxId: { ...constraints.taxId, default: "" },
  line1: { ...constraints.line1, default: "" },
  line2: { ...constraints.line2, default: "" },
  postalCode: { ...constraints.postalCode, default: "" },
  postalCity: { ...constraints.postalCity, default: "" },
  province: { ...constraints.province, default: "" },
  country: { ...constraints.country, default: "" },
  shippingNotes: { ...constraints.shippingNotes, default: "" },
  internalShippingNotes: {
    ...constraints.internalShippingNotes,
    default: "",
  },
  addressLink: { ...constraints.addressLink, default: "" },
};

const supplier = t.Object(
  { uuid: resourceUuid, ...fields },
  {
    additionalProperties: false,
  },
);

export const SupplierModel = {
  query: t.Object({ ...pageQuery.properties, active: queryFlag }),
  params: resourceParams,
  body: t.Object(
    {
      ...fields,
      image: t.Optional(fields.image),
    },
    { additionalProperties: false },
  ),
  patch: t.Partial(t.Object(constraints, { additionalProperties: false })),
  supplier,
  list: t.Object({
    items: t.Array(supplier),
    total: t.Integer(),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
  success: successBody,
} as const;
export type SupplierModel = {
  [K in keyof typeof SupplierModel]: UnwrapSchema<(typeof SupplierModel)[K]>;
};

export type SupplierDatabase = Prisma.TransactionClient | PrismaClient;
export type SupplierRecord = Supplier;
