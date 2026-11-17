import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Generation needs no credentials; migration commands require DATABASE_URL.
  datasource: { url: process.env.DATABASE_URL },
});
