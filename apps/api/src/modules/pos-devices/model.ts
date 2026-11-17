import { t, type UnwrapSchema } from "elysia";
import type { Prisma } from "../../../prisma/generated/prisma/client";
import { PosDevicePlain } from "../../../prisma/generated/typebox/PosDevice";
import { pageQuery, resourceUuid } from "@/lib/dto";

const name = {
  ...PosDevicePlain.properties.name,
  minLength: 1,
  maxLength: 100,
  pattern: "\\S",
};

const bankName = {
  ...PosDevicePlain.properties.bankName,
  minLength: 1,
  maxLength: 100,
  pattern: "\\S",
};

const terminalId = {
  ...PosDevicePlain.properties.terminalId,
  minLength: 1,
  maxLength: 100,
  pattern: "\\S",
};

const version = {
  ...PosDevicePlain.properties.version,
  minimum: 0,
};

/**
 * Immutable owning branch. Devices are branch-owned, so every device and every
 * report derived from it exposes the same two public identifiers.
 */
export const posBranch = t.Object(
  {
    uuid: resourceUuid,
    name: t.String({ minLength: 1, maxLength: 100 }),
    active: t.Boolean(),
  },
  { additionalProperties: false },
);

/** Presentation columns; the internal integer id never leaves the service. */
export const posDeviceColumns = {
  uuid: true,
  name: true,
  bankName: true,
  terminalId: true,
  active: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { uuid: true, name: true, active: true } },
} satisfies Prisma.PosDeviceSelect;

export type PosDeviceRecord = Prisma.PosDeviceGetPayload<{
  select: typeof posDeviceColumns;
}>;

const device = t.Object(
  {
    uuid: resourceUuid,
    name,
    bankName,
    terminalId,
    active: PosDevicePlain.properties.active,
    version,
    branch: posBranch,
    createdAt: PosDevicePlain.properties.createdAt,
    updatedAt: PosDevicePlain.properties.updatedAt,
  },
  { additionalProperties: false },
);

export const PosDevicesModel = {
  params: t.Object(
    { deviceUuid: resourceUuid },
    { additionalProperties: false },
  ),
  query: pageQuery,
  body: t.Object(
    {
      name,
      bankName,
      terminalId,
      active: PosDevicePlain.properties.active,
    },
    { additionalProperties: false },
  ),
  patch: t.Object(
    {
      name,
      bankName,
      terminalId,
      active: PosDevicePlain.properties.active,
      version,
    },
    { additionalProperties: false },
  ),
  device,
  list: t.Object({
    items: t.Array(device),
    total: t.Integer({ minimum: 0 }),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
} as const;
export type PosDevicesModel = {
  [K in keyof typeof PosDevicesModel]: UnwrapSchema<
    (typeof PosDevicesModel)[K]
  >;
};
