import { RedisClient } from "bun";
import env from "./env";

export const redis = new RedisClient(env.REDIS_URL, {
  connectionTimeout: 3000,
  enableOfflineQueue: false,
  maxRetries: 3,
});

export async function withTimeout<T>(
  operation: Promise<T>,
  milliseconds = 3000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Dependency timeout")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function pingRedis(): Promise<void> {
  await withTimeout(redis.send("PING", []));
}
