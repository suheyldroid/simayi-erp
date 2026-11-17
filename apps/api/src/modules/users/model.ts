import { t, type UnwrapSchema } from "elysia";
import type { User } from "../../../prisma/generated/prisma/client";
import { MemberPlain } from "../../../prisma/generated/typebox/Member";
import { UserPlain } from "../../../prisma/generated/typebox/User";
import type { auth } from "../auth/auth";
import { avatarReferencePattern } from "../media/model";

const profileBase = t.Pick(UserPlain, ["name", "image"]);

const canonicalAvatarImage = t.String({
  pattern: `^${avatarReferencePattern}$`,
  maxLength: 51,
});

const profileBody = t.Partial(
  t.Object(
    {
      ...profileBase.properties,
      name: {
        ...profileBase.properties.name,
        minLength: 1,
        maxLength: 150,
        pattern: "\\S",
      },
      image: t.Union([
        {
          ...t.Exclude(profileBase.properties.image, t.Null()),
          format: "uri",
          pattern: "^https?://",
          maxLength: 2048,
        },
        canonicalAvatarImage,
        t.Null(),
      ]),
    },
    { minProperties: 1, additionalProperties: false },
  ),
);

const memberBase = t.Pick(MemberPlain, ["userId", "role"]);

const roleName = {
  ...memberBase.properties.role,
  minLength: 1,
  maxLength: 128,
};

const memberRole = t.Union([
  roleName,
  t.Array(roleName, { minItems: 1, maxItems: 32 }),
]);

export const UsersModel = {
  user: UserPlain,
  params: t.Object({
    id: {
      ...UserPlain.properties.id,
      minLength: 1,
      maxLength: 128,
    },
  }),
  listQuery: t.Object({
    search: t.Optional(t.String({ maxLength: 150 })),
    limit: t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1, default: 20 }),
    offset: t.Numeric({
      minimum: 0,
      maximum: 1000000,
      multipleOf: 1,
      default: 0,
    }),
  }),
  listResponse: t.Object({
    users: t.Array(UserPlain),
    total: t.Integer({ minimum: 0 }),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
  profileBody,
  statusBody: t.Pick(UserPlain, ["isActive"], {
    additionalProperties: false,
  }),
  memberBody: t.Object(
    {
      ...memberBase.properties,
      userId: {
        ...memberBase.properties.userId,
        minLength: 1,
        maxLength: 128,
      },
      role: memberRole,
    },
    { additionalProperties: false },
  ),
  memberParams: t.Object({
    memberId: {
      ...MemberPlain.properties.id,
      minLength: 1,
      maxLength: 128,
    },
  }),
  memberRoleBody: t.Object(
    { role: memberRole },
    { additionalProperties: false },
  ),
  member: MemberPlain,
} as const;

export type UsersModel = {
  [Key in keyof typeof UsersModel]: UnwrapSchema<(typeof UsersModel)[Key]>;
};

export type UsersRecord = Pick<User, keyof UsersModel["user"]>;
export type UsersUpdate = NonNullable<
  Parameters<typeof auth.api.adminUpdateUser>[0]
>["body"]["data"];

export type UsersMemberRecord = Omit<
  UsersModel["member"],
  "role" | "createdAt"
> & {
  role: string | string[];
  createdAt: Date | string;
};
