import { Prisma } from "../../../prisma/generated/prisma/client";
import createError from "http-errors";
import { decimal } from "@/lib/decimal";
import {
  referencePattern,
  referenceToken,
  type ReferencePatternKey,
} from "@/lib/reference";

const maxReference = 9223372036854775807n;

export abstract class OrderService {
  static escape(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  static compiled(pattern: string): {
    expression: RegExp;
    width: number | null;
    token: string;
  } {
    const parsed = referenceToken(pattern);
    const [prefix, suffix] = pattern.split(parsed.token);
    return {
      expression: new RegExp(
        `^${OrderService.escape(prefix ?? "")}(\\d+)${OrderService.escape(suffix ?? "")}$`,
      ),
      width: parsed.width,
      token: parsed.token,
    };
  }

  static integer(digits: string): bigint {
    if (digits.length > 19)
      throw new createError.UnprocessableEntity(
        "Reference number is outside the supported range",
      );
    const value = BigInt(digits);
    if (value > maxReference)
      throw new createError.UnprocessableEntity(
        "Reference number is outside the supported range",
      );
    return value;
  }

  static format(
    pattern: string,
    value: bigint,
  ): { reference: string; referenceInt: bigint } {
    const parsed = OrderService.compiled(pattern);
    const digits =
      parsed.width === null
        ? value.toString()
        : value.toString().padStart(parsed.width, "0");
    const reference = pattern.replace(parsed.token, digits);
    if (reference.length > 64)
      throw new createError.UnprocessableEntity(
        "Generated reference exceeds 64 characters",
      );
    return { reference, referenceInt: value };
  }

  static match(
    pattern: string,
    reference: string,
  ): { reference: string; referenceInt: bigint } {
    const parsed = OrderService.compiled(pattern);
    const found = parsed.expression.exec(reference.trim());
    if (!found)
      throw new createError.UnprocessableEntity(
        "Reference does not match the required pattern",
      );
    return {
      reference: reference.trim(),
      referenceInt: OrderService.integer(found[1] ?? ""),
    };
  }

  static pattern(key: ReferencePatternKey): string {
    const value = referencePattern(key);
    referenceToken(value);
    return value;
  }

  static async reference(
    key: ReferencePatternKey,
    supplied: string | undefined,
    next: () => Promise<bigint>,
    taken: (reference: string) => Promise<boolean>,
  ): Promise<{ reference: string; referenceInt: bigint }> {
    const pattern = OrderService.pattern(key);
    const resolved =
      supplied === undefined || supplied.trim() === ""
        ? OrderService.format(pattern, (await next()) + 1n)
        : OrderService.match(pattern, supplied);
    if (await taken(resolved.reference))
      throw new createError.Conflict("Reference is already used");
    return resolved;
  }

  static day(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new createError.UnprocessableEntity("Expected a calendar date");
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw new createError.UnprocessableEntity("Expected a calendar date");
    return date;
  }

  static today(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  static quantity(value: string): Prisma.Decimal {
    const result = decimal(value, 5, 10);
    if (result.lte(0))
      throw new createError.UnprocessableEntity(
        "Quantity must be greater than zero",
      );
    return result;
  }

  static discount(value: string | undefined): Prisma.Decimal {
    const result = decimal(value ?? "0", 2, 3);
    if (result.gt(100))
      throw new createError.UnprocessableEntity("Discount cannot exceed 100");
    return result;
  }

  static money(value: string): Prisma.Decimal {
    return decimal(value, 6, 13);
  }

  static lineNumber(value: string | undefined): {
    line: string;
    lineInt: number;
  } {
    const line = value?.trim() ?? "";
    if (!/^\d+$/.test(line)) return { line, lineInt: 0 };
    if (line.length > 10 || Number(line) > 2147483647)
      throw new createError.UnprocessableEntity(
        "Line number is outside the supported range",
      );
    return { line, lineInt: Number(line) };
  }

  static optionalDay(
    value: string | null | undefined,
  ): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return OrderService.day(value);
  }
}
