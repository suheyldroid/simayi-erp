import { t, type UnwrapSchema } from "elysia";
import { SystemPreferencePlain } from "../../../prisma/generated/typebox/SystemPreference";

/**
 * The singleton row is never exposed. Only the system currency leaves the
 * server. It is written once and then immutable: null on read always means
 * "not configured" rather than an assumed currency.
 */
export const SystemPreferencesModel = {
  body: t.Object(
    {
      defaultCurrencyCode: t.String({
        minLength: 3,
        maxLength: 3,
        pattern: "^[A-Za-z]{3}$",
      }),
    },
    { additionalProperties: false },
  ),
  preference: t.Pick(SystemPreferencePlain, ["defaultCurrencyCode"]),
} as const;
export type SystemPreferencesModel = {
  [K in keyof typeof SystemPreferencesModel]: UnwrapSchema<
    (typeof SystemPreferencesModel)[K]
  >;
};
