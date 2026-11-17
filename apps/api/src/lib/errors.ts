import createError from "http-errors";

export function organizationMismatch(): createError.HttpError {
  const error = new createError.Conflict(
    "Active organization does not match the request",
  );
  return Object.assign(error, { apiCode: "ORGANIZATION_MISMATCH" });
}

export function invalidBranchId(): createError.HttpError {
  const error = new createError.UnprocessableEntity(
    "X-Branch-Id must be a branch UUID",
  );
  return Object.assign(error, { apiCode: "INVALID_BRANCH_ID" });
}

export function branchRequired(): createError.HttpError {
  const error = new createError.BadRequest("Branch context required");
  return Object.assign(error, { apiCode: "BRANCH_REQUIRED" });
}

export function branchInactive(): createError.HttpError {
  const error = new createError.Conflict("Branch is inactive");
  return Object.assign(error, { apiCode: "BRANCH_INACTIVE" });
}

export function branchInUse(details: {
  stockBalances: number;
  openPurchaseOrders: number;
  draftSalesBatches: number;
  activePosDevices: number;
}): createError.HttpError {
  const error = new createError.Conflict(
    "Branch still has stock or unresolved operational work",
  );
  return Object.assign(error, { apiCode: "BRANCH_IN_USE", details });
}

export function apiErrorBody(
  error: createError.HttpError,
  code?: string,
  details?: unknown,
) {
  const standard = createError(error.status);
  return {
    error: {
      code:
        code ??
        standard.name
          .replace(/Error$/, "")
          .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
          .toUpperCase(),
      message: error.expose ? error.message : standard.message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}
