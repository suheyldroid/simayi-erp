// Prisma ORM 7. Run from this directory after installing the fork dependencies.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: './prisma',
  migrations: { path: './prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
