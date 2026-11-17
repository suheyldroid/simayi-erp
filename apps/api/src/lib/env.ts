import { Type as t } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import path from "node:path";
import "dotenv/config";

const schema = t.Object({
  DATABASE_URL: t.String({ minLength: 1 }),
  REDIS_URL: t.String({ default: "redis://127.0.0.1:6379" }),
  BETTER_AUTH_URL: t.String({ minLength: 1 }),
  BETTER_AUTH_SECRET: t.String({ minLength: 32 }),
  TRUSTED_ORIGINS: t.String({ minLength: 1 }),
  HOST: t.String({ default: "127.0.0.1" }),
  PORT: t.Integer({ minimum: 1, maximum: 65535, default: 3000 }),
  // Private on-disk media root. Relative keys resolved under it and nothing
  // outside it is ever read or written, so a persistent absolute path is
  // required.
  MEDIA_ROOT: t.String({
    minLength: 1,
    default: path.resolve(import.meta.dir, "../../media"),
  }),
  NODE_ENV: t.Union(
    [t.Literal("development"), t.Literal("production"), t.Literal("test")],
    { default: "development" },
  ),
});

export function parseEnv(input: Record<string, unknown>) {
  // Do not include input values in configuration errors: they can contain secrets.
  let value;
  try {
    value = Value.Parse(schema, input);
  } catch {
    throw new Error("Invalid environment configuration; check .env.example");
  }
  const url = (raw: string, protocols: string[], name: string) => {
    try {
      const parsed = new URL(raw);
      if (!protocols.includes(parsed.protocol) || !parsed.hostname)
        throw new Error();
      return parsed;
    } catch {
      throw new Error(`Invalid ${name}`);
    }
  };
  url(value.DATABASE_URL, ["postgres:", "postgresql:"], "DATABASE_URL");
  url(value.REDIS_URL, ["redis:", "rediss:"], "REDIS_URL");
  if (!path.isAbsolute(value.MEDIA_ROOT) || value.MEDIA_ROOT.includes("\0"))
    throw new Error("MEDIA_ROOT must be an absolute path");
  const authUrl = url(
    value.BETTER_AUTH_URL,
    ["http:", "https:"],
    "BETTER_AUTH_URL",
  );
  const origins = value.TRUSTED_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!origins.length) throw new Error("TRUSTED_ORIGINS must not be empty");
  for (const origin of origins) {
    const parsed = url(origin, ["http:", "https:"], "TRUSTED_ORIGINS");
    if (parsed.origin !== origin)
      throw new Error("TRUSTED_ORIGINS must contain origins without paths");
    if (value.NODE_ENV === "production" && parsed.protocol !== "https:")
      throw new Error("Production origins must use HTTPS");
  }
  if (value.NODE_ENV === "production") {
    if (authUrl.protocol !== "https:")
      throw new Error("Production BETTER_AUTH_URL must use HTTPS");
    if (
      value.BETTER_AUTH_SECRET ===
      "development-only-change-this-secret-123456789"
    )
      throw new Error("Replace the development auth secret");
  }
  return {
    ...value,
    AUTH_ORIGIN: authUrl.origin,
    TRUSTED_ORIGINS: origins.join(","),
  };
}

const env = parseEnv({ ...process.env });
export const trustedOrigins = env.TRUSTED_ORIGINS.split(",");
export const isProduction = env.NODE_ENV === "production";
export default env;
