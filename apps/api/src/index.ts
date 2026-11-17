import { app } from "./app";
import env from "./lib/env";
import { pingDatabase, disconnectPrisma } from "./lib/prisma";
import { redis, pingRedis } from "./lib/redis";
import { log, logError } from "./lib/logger";

let shuttingDown = false;

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log({ level: "info", message: `Shutting down (${signal})` });
  const deadline = setTimeout(() => {
    log({ level: "error", message: "Shutdown deadline exceeded" });
    process.exit(1);
  }, 10000);
  try {
    if (app.server) await app.stop();
  } catch (error) {
    exitCode = 1;
    logError(error);
  } finally {
    redis.close();
    try {
      await disconnectPrisma();
    } catch (error) {
      exitCode = 1;
      logError(error);
    }
    clearTimeout(deadline);
    process.exit(exitCode);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

try {
  await Promise.all([pingDatabase(), redis.connect()]);
  await pingRedis();
  app.listen({ hostname: env.HOST, port: env.PORT });
  log({ level: "info", message: `API listening on ${env.HOST}:${env.PORT}` });
} catch (error) {
  logError(error);
  await shutdown("startup failure", 1);
}
