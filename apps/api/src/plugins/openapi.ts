import { openapi, type ElysiaOpenAPIConfig } from "@elysia/openapi";
import { Elysia } from "elysia";
import { isProduction } from "../lib/env";
import { auth } from "../modules/auth/auth";

const authSchema = isProduction
  ? undefined
  : await auth.api.generateOpenAPISchema();
const paths = Object.fromEntries(
  Object.entries(authSchema?.paths ?? {}).map(([path, operations]) => [
    `/auth${path}`,
    Object.fromEntries(
      (["get", "post", "put", "patch", "delete"] as const).flatMap((method) => {
        const operation = operations[method];
        return operation
          ? [
              [
                method,
                {
                  ...operation,
                  security: operation.security
                    ? [{ cookieAuth: [] }]
                    : undefined,
                },
              ],
            ]
          : [];
      }),
    ),
  ]),
);

// SAFETY: Better Auth generates OpenAPI; the two libraries publish incompatible
// structural types for that same format.
const documentation = {
  info: {
    title: "Simayi ERP API",
    version: "1.0.0",
    description:
      "API errors use { error: { code, message, details? } }. Better Auth handler errors retain its native { code, message } format. Business routes require a verified session and the optional `X-Organization-Id` (must match the active organization) plus the optional `X-Branch-Id` branch UUID, which must belong to that organization; an omitted branch means company context.",
  },
  paths,
  tags: [
    { name: "Health", description: "Liveness and readiness" },
    { name: "Auth", description: "Session and identity" },
    { name: "Branches", description: "Company branch registry" },
  ],
  components: {
    schemas: authSchema?.components?.schemas,
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "better-auth.session_token",
      },
    },
  },
} as unknown as NonNullable<ElysiaOpenAPIConfig["documentation"]>;

export const openapiPlugin = new Elysia({ name: "openapi" }).use(
  openapi({ enabled: !isProduction, documentation }),
);
