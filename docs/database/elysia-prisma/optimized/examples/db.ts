// Prisma 7: generated client + PostgreSQL driver adapter.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// Reuse this instance across services; disconnect during application shutdown.
