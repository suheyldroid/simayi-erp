import { logError } from "@/lib/logger";
import { disconnectPrisma } from "@/lib/prisma";
import { MediaFilesService } from "@/modules/media/service";

/**
 * Bounded deferred cleanup. Run it from an operator or scheduled job:
 *
 *   bun run media:cleanup --limit 500
 *
 * It is not an HTTP route. Candidates are actionable rows only (expired
 * temporary, or a deletion due for retry), ordered by the oldest attempt, and
 * each row is owned by a conditional update that excludes any committed
 * organization logo reference. A file a live organization references is never
 * unlinked.
 */
function limitArgument(): number {
  const index = process.argv.indexOf("--limit");
  if (index === -1) return 500;
  const parsed = Number(process.argv[index + 1]);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5000)
    throw new Error("--limit must be an integer between 1 and 5000");
  return parsed;
}

try {
  const limit = limitArgument();
  const cleanup = await MediaFilesService.cleanupExpired({ limit });
  process.stdout.write(`${JSON.stringify({ cleanup, limit })}\n`);
  if (cleanup.failed > 0) process.exitCode = 1;
} catch (error) {
  logError(error);
  process.exitCode = 1;
} finally {
  await disconnectPrisma();
}
