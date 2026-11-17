import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../prisma/generated/prisma/client";
import env from "./env";

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30000,
  statement_timeout: 5000,
  query_timeout: 6000,
});

// Connect during startup, not at import time.
export const prisma = new PrismaClient({ adapter });

export async function pingDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
