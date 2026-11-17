import { Prisma } from "../../prisma/generated/prisma/client";
import createError from "http-errors";

// Keep intermediate calculations exact beyond the database's 20-digit rate precision.
export const Decimal = Prisma.Decimal.clone({
  precision: 80,
  rounding: Prisma.Decimal.ROUND_HALF_UP,
});

export function decimal(value: string, scale = 6, integerDigits = 14) {
  if (!/^-?\d+(?:\.\d+)?$/.test(value) || value.length > 100)
    throw new createError.UnprocessableEntity(
      "Expected a plain decimal string",
    );
  const result = new Decimal(value);
  if (
    !result.isFinite() ||
    result.decimalPlaces() > scale ||
    result.abs().gte(new Decimal(10).pow(integerDigits))
  )
    throw new createError.UnprocessableEntity(
      "Decimal exceeds the supported precision or scale",
    );
  return result;
}
