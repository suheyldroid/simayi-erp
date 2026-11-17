import {
  imageMaxBytes,
  verifyImageBytes,
  type VerifiedImage,
} from "@/lib/images";
import { logError } from "@/lib/logger";
import { disconnectPrisma, prisma } from "@/lib/prisma";
import {
  logoReferencePattern,
  logoReferencePrefix,
  mediaPurpose,
} from "@/modules/media/model";
import { MediaFilesService } from "@/modules/media/service";

/**
 * Non-destructive operational migration for historical organization logos.
 *
 *   bun run media:migrate-logos --dry-run
 *   bun run media:migrate-logos --batch 200
 *
 * The script pages through every organization by id until the set is
 * exhausted, so a rerun is not limited to the first page. `--batch` bounds the
 * page size, not the total scan; an interrupted run is simply started again.
 * A `data:` URI is decoded, verified with the shared image contract, stored on
 * disk as an unclaimed temporary logo, and replaced only while
 * `organization.logo` still equals the original value. The native organization
 * update then claims the file inside its own transaction through the
 * `organization_logo_media` trigger. Historical `http(s)` logos are preserved
 * untouched and reported for a separate manual decision; no server-side fetch
 * is performed. Any other value or malformed data URI fails the run loudly and
 * is left unchanged.
 */
const canonicalLogo = new RegExp(`^${logoReferencePattern}$`);
const dataUri = /^data:([^;,]*)(;base64)?,(.*)$/is;

type Failure = { organizationId: string; reason: string };

function batchArgument(): number {
  const index = process.argv.indexOf("--batch");
  if (index === -1) return 200;
  const parsed = Number(process.argv[index + 1]);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000)
    throw new Error("--batch must be an integer between 1 and 1000");
  return parsed;
}

function decodeLogoDataUri(value: string): Uint8Array {
  const match = dataUri.exec(value);
  if (!match) throw new Error("malformed logo data URI");
  const payload = match[3] ?? "";
  if (payload.length > Math.ceil((imageMaxBytes * 4) / 3) + 16)
    throw new Error("logo data URI is too large");
  if (match[2]?.toLowerCase() === ";base64")
    return new Uint8Array(Buffer.from(payload, "base64"));
  try {
    return new Uint8Array(Buffer.from(decodeURIComponent(payload), "binary"));
  } catch {
    throw new Error("malformed logo data URI");
  }
}

function failureReason(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const dryRun = process.argv.includes("--dry-run");

try {
  const batch = batchArgument();
  const failures: Failure[] = [];
  let scanned = 0;
  let migrated = 0;
  let wouldMigrate = 0;
  let alreadyCanonical = 0;
  let external = 0;
  let empty = 0;
  let concurrent = 0;
  let cursor: string | null = null;

  for (;;) {
    const organizations: { id: string; logo: string | null }[] =
      await prisma.organization.findMany({
        where: {
          logo: { not: null },
          ...(cursor === null ? {} : { id: { gt: cursor } }),
        },
        select: { id: true, logo: true },
        orderBy: { id: "asc" },
        take: batch,
      });
    const last: { id: string; logo: string | null } | undefined =
      organizations.at(-1);
    if (!last) break;
    cursor = last.id;
    scanned += organizations.length;
    for (const organization of organizations) {
      const logo = organization.logo;
      if (logo === null || logo === "") {
        empty += 1;
        continue;
      }
      if (canonicalLogo.test(logo)) {
        const row = await prisma.mediaFile.findFirst({
          where: {
            uuid: logo.slice(logoReferencePrefix.length),
            purpose: mediaPurpose.organizationLogo,
          },
          select: { id: true },
        });
        if (row === null)
          failures.push({
            organizationId: organization.id,
            reason: "canonical logo has no media row",
          });
        else alreadyCanonical += 1;
        continue;
      }
      if (!/^data:/i.test(logo)) {
        if (/^https?:\/\//i.test(logo)) {
          external += 1;
          continue;
        }
        failures.push({
          organizationId: organization.id,
          reason: "unsupported logo value",
        });
        continue;
      }
      let image: VerifiedImage;
      try {
        image = verifyImageBytes(decodeLogoDataUri(logo));
      } catch (error) {
        failures.push({
          organizationId: organization.id,
          reason: failureReason(error, "unsupported logo image"),
        });
        continue;
      }
      if (dryRun) {
        wouldMigrate += 1;
        continue;
      }
      const uuid = await MediaFilesService.importTemporaryLogo({
        originalName: `organization-logo.${image.kind}`,
        image,
      }).catch((error: unknown) => {
        failures.push({
          organizationId: organization.id,
          reason: failureReason(error, "could not store the logo file"),
        });
        return null;
      });
      if (uuid === null) continue;
      try {
        // The database trigger claims the temporary file only if this exact
        // row still holds the imported value, in this same transaction.
        const updated = await prisma.organization.updateMany({
          where: { id: organization.id, logo },
          data: { logo: `${logoReferencePrefix}${uuid}` },
        });
        if (updated.count === 0) {
          await MediaFilesService.discardImportedLogo(uuid);
          concurrent += 1;
          continue;
        }
        migrated += 1;
      } catch (error) {
        await MediaFilesService.discardImportedLogo(uuid);
        failures.push({
          organizationId: organization.id,
          reason: failureReason(error, "could not replace the logo reference"),
        });
      }
    }
    if (organizations.length < batch) break;
  }

  const summary = {
    dryRun,
    batch,
    scanned,
    migrated,
    wouldMigrate,
    alreadyCanonical,
    external,
    empty,
    concurrent,
    failures: failures.length,
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  for (const failure of failures)
    process.stderr.write(
      `${JSON.stringify({ level: "error", message: "logo migration failed", ...failure })}\n`,
    );
  if (failures.length > 0) process.exitCode = 1;
} catch (error) {
  logError(error);
  process.exitCode = 1;
} finally {
  await disconnectPrisma();
}
