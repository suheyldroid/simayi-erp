import { t, type UnwrapSchema } from "elysia";

const currency = t.Object(
  {
    code: t.String({ minLength: 3, maxLength: 3, pattern: "^[A-Z]{3}$" }),
    name: t.String({ minLength: 1, maxLength: 120 }),
    fractionDigits: t.Integer({ minimum: 0, maximum: 4 }),
  },
  { additionalProperties: false },
);

export const CurrenciesModel = {
  currencies: t.Object(
    { items: t.Array(currency) },
    { additionalProperties: false },
  ),
} as const;
export type CurrenciesModel = {
  [K in keyof typeof CurrenciesModel]: UnwrapSchema<
    (typeof CurrenciesModel)[K]
  >;
};
