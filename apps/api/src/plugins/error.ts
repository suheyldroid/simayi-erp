import { Prisma } from "../../prisma/generated/prisma/client";
import { Elysia } from "elysia";
import createError from "http-errors";
import { apiErrorBody } from "../lib/errors";
import { isProduction } from "../lib/env";
import { logError } from "../lib/logger";

/**
 * Raw `$queryRaw`/`$executeRaw` failures bypass Prisma's generic SQLSTATE
 * mapping and surface as P2010 with the original SQLSTATE on the driver
 * adapter cause. Only serialization failures and deadlocks are concurrent
 * write conflicts; every other raw error stays an internal failure.
 */
function rawTransactionConflict(
  meta: Record<string, unknown> | undefined,
): boolean {
  const driver = meta?.driverAdapterError;
  if (typeof driver !== "object" || driver === null || !("cause" in driver))
    return false;
  const cause = driver.cause;
  if (typeof cause !== "object" || cause === null || !("originalCode" in cause))
    return false;
  return cause.originalCode === "40001" || cause.originalCode === "40P01";
}

export const errorPlugin = new Elysia({ name: "error-handler" }).onError(
  { as: "global" },
  ({ code, error, set }) => {
    let httpError: createError.HttpError;
    let responseCode: string | undefined;
    let details: unknown;

    if (createError.isHttpError(error)) {
      httpError = error;
      if ("apiCode" in error && typeof error.apiCode === "string")
        responseCode = error.apiCode;
      if ("details" in error) details = error.details;
    } else if (code === "VALIDATION") {
      httpError = new createError.UnprocessableEntity("Validation failed");
      responseCode = "VALIDATION";
      details = isProduction
        ? undefined
        : error.all.flatMap((issue) =>
            issue ? [{ path: issue.path, message: issue.message }] : [],
          );
    } else if (code === "NOT_FOUND") {
      httpError = new createError.NotFound("Route not found");
    } else if (code === "PARSE") {
      httpError = new createError.BadRequest("Malformed request body");
      responseCode = "PARSE";
    } else if (code === "INVALID_COOKIE_SIGNATURE") {
      httpError = new createError.Unauthorized("Invalid cookie signature");
    } else if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" ||
        (error.code === "P2010" && rawTransactionConflict(error.meta)))
    ) {
      httpError = new createError.Conflict(
        "Concurrent resource change; reload and retry",
      );
      responseCode = "CONCURRENT_UPDATE";
    } else if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2003"].includes(error.code)
    ) {
      httpError = new createError.Conflict("Resource conflict");
    } else if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      httpError = new createError.NotFound("Resource not found");
    } else if (
      error instanceof Prisma.PrismaClientInitializationError ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2024", "P2037"].includes(error.code))
    ) {
      httpError = new createError.ServiceUnavailable();
    } else {
      httpError = new createError.InternalServerError();
    }

    if (httpError.status >= 500) logError(error);
    set.status = httpError.status;
    Object.assign(set.headers, httpError.headers);
    return apiErrorBody(httpError, responseCode, details);
  },
);
