import { t, type UnwrapSchema } from "elysia";
import type { Prisma } from "../../../../prisma/generated/prisma/client";
import { SalesChannelPlain } from "../../../../prisma/generated/typebox/SalesChannel";
import { pageQuery, resourceParams, resourceUuid } from "@/lib/dto";

export const channelSelect = {
  uuid: true,
  name: true,
  active: true,
  createdAt: true,
} satisfies Prisma.SalesChannelSelect;

export type ChannelRecord = Prisma.SalesChannelGetPayload<{
  select: typeof channelSelect;
}>;

const name = {
  ...SalesChannelPlain.properties.name,
  minLength: 1,
  maxLength: 100,
  pattern: "\\S",
};

const channel = t.Object(
  {
    uuid: resourceUuid,
    name,
    active: SalesChannelPlain.properties.active,
    createdAt: SalesChannelPlain.properties.createdAt,
  },
  { additionalProperties: false },
);

export const SalesChannelsModel = {
  params: resourceParams,
  query: pageQuery,
  channel,
  body: t.Object({ name }, { additionalProperties: false }),
  patch: t.Object(
    {
      name: t.Optional(name),
      active: t.Optional(SalesChannelPlain.properties.active),
    },
    { additionalProperties: false },
  ),
  list: t.Object({
    items: t.Array(channel),
    total: t.Integer({ minimum: 0 }),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
} as const;

export type SalesChannelsModel = {
  [K in keyof typeof SalesChannelsModel]: UnwrapSchema<
    (typeof SalesChannelsModel)[K]
  >;
};
