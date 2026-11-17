import { Elysia } from "elysia";
import { log } from "../lib/logger";

export const requestLogPlugin = new Elysia({
  name: "request-log",
}).onAfterResponse(
  { as: "global" },
  ({ request, set, responseValue, path }) => {
    const status =
      responseValue instanceof Response
        ? responseValue.status
        : typeof set.status === "number"
          ? set.status
          : 200;
    log({
      level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
      message: "request",
      method: request.method,
      path,
      status,
    });
  },
);
