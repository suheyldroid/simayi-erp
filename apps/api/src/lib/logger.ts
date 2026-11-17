import { Prisma } from "../../prisma/generated/prisma/client";

type LogFields = {
  level: "info" | "warn" | "error";
  message: string;
  method?: string;
  path?: string;
  status?: number;
  errorName?: string;
  errorCode?: string;
  stack?: string[];
};

export function log(fields: LogFields): void {
  process.stdout.write(
    `${JSON.stringify({ ts: new Date().toISOString(), ...fields })}\n`,
  );
}

export function logError(error: unknown): void {
  // Error messages/SQL can contain passwords, tokens and connection strings.
  // Keep only call-site frames; never log headers, bodies or query strings.
  // Prisma's request code (for example P2010) is a fixed identifier and the
  // only diagnostic that survives this filter, so record it when present.
  const prismaCode =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : undefined;
  log({
    level: "error",
    message: "Operation failed",
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorCode:
      prismaCode && /^P\d{4}$/.test(prismaCode) ? prismaCode : undefined,
    stack:
      error instanceof Error
        ? error.stack
            ?.split("\n")
            .filter((line) => /^\s+at /.test(line))
            .slice(0, 12)
        : undefined,
  });
}
