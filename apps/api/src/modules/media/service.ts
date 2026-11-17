import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import createError from "http-errors";
import {
  imageContentTypes,
  imageFileParts,
  readImageUpload,
  type ImageKind,
  type VerifiedImage,
} from "@/lib/images";
import { log } from "@/lib/logger";
import { MediaService } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import type { TenantActor } from "@/lib/tenant";
import {
  MediaFilesModel,
  avatarReferencePattern,
  avatarReferencePrefix,
  logoReferencePattern,
  logoReferencePrefix,
  mediaFileColumns,
  mediaPurpose,
  mediaStatus,
  type Database,
  type ImagePurpose,
  type MediaPurpose,
} from "./model";

/** Temporary uploads stay claimable for one day, then deferred cleanup may remove them. */
const temporaryLifetimeMs = 24 * 60 * 60 * 1000;
/** A deletion that stopped mid-run is retried only after this delay. */
const deletionRetryDelayMs = 5 * 60 * 1000;

const logoReference = new RegExp(`^${logoReferencePattern}$`);

/** The one public form of a stored logo. */
function canonicalLogoReference(uuid: string): string {
  return `${logoReferencePrefix}${uuid}`;
}

/** The UUID of an exact canonical `/media/<uuid>` reference, or null. */
function logoUuid(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !logoReference.test(value)) return null;
  return value.slice(logoReferencePrefix.length);
}

const avatarReference = new RegExp(`^${avatarReferencePattern}$`);

/** The one public form of an account avatar. */
function canonicalAvatarReference(uuid: string): string {
  return `${avatarReferencePrefix}${uuid}`;
}

/** The UUID of an exact canonical `/media/avatars/<uuid>` reference, or null. */
function avatarUuid(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !avatarReference.test(value)) return null;
  return value.slice(avatarReferencePrefix.length);
}

const imageReferencePrefixes: Record<ImagePurpose, string> = {
  [mediaPurpose.itemImage]: "/items/images/",
  [mediaPurpose.supplierImage]: "/supplier/images/",
};

const workbookContentType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** The public wire reference stored in `Item.image` / `Supplier.image`. */
function imageReference(
  purpose: ImagePurpose,
  uuid: string,
  kind: string,
): string {
  return `${imageReferencePrefixes[purpose]}${uuid}.${kind}`;
}

/** UUID and kind of a wire reference for the given image purpose, or null. */
function imageReferenceParts(
  purpose: ImagePurpose,
  value: string,
): { uuid: string; kind: ImageKind } | null {
  const prefix = imageReferencePrefixes[purpose];
  if (!value.startsWith(prefix)) return null;
  return imageFileParts(value.slice(prefix.length));
}

/** Internal binding label of one sales workbook. */
function workbookReference(batchUuid: string): string {
  return `sales-batch:${batchUuid}`;
}

/** Keeps only a safe basename for stored metadata; the disk key never uses it. */
function storedOriginalName(value: string, fallback: string): string {
  const base = value.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255);
  return cleaned === "" ? fallback : cleaned;
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

/** Filesystem error codes are safe retry metadata; paths and messages are not. */
function filesystemErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  )
    return error.code;
  return error instanceof Error ? error.name : "UnknownError";
}

async function located(file: {
  storageKey: string;
  contentType: string;
}): Promise<{ path: string; contentType: string }> {
  const full = MediaService.location(file.storageKey);
  try {
    await stat(full);
  } catch (error) {
    if (isMissingFile(error))
      throw new createError.NotFound("Media file was not found");
    throw error;
  }
  return { path: full, contentType: file.contentType };
}

async function requireMembership(
  userId: string,
  organizationId: string,
): Promise<void> {
  const member = await prisma.member.findFirst({
    where: { userId, organizationId },
    select: { id: true },
  });
  if (!member) throw new createError.NotFound("Media file was not found");
}

type LogoRow = {
  purpose: string;
  status: number;
  uploaderId: string | null;
  organizationId: string | null;
  expiresAt: Date | null;
};

/** True while the row may still be bound by a native organization write. */
function claimableTemporary(row: LogoRow | null, userId: string): boolean {
  return (
    row !== null &&
    row.purpose === mediaPurpose.organizationLogo &&
    row.status === mediaStatus.temporary &&
    row.organizationId === null &&
    row.uploaderId === userId &&
    row.expiresAt !== null &&
    row.expiresAt.getTime() > Date.now()
  );
}

/**
 * Central metadata for every disk-backed binary object. The row is written
 * before its bytes, public identity is always the UUID, and the storage key
 * never leaves the service.
 *
 * Binding is not performed by the service: the `organization_logo_media`
 * database trigger claims, releases, and validates logos in the same
 * transaction as the native organization write. The native hooks only provide
 * an earlier, friendlier rejection for the same rules.
 */
export abstract class MediaFilesService {
  /**
   * Stores one verified image as an uploader-owned temporary file. The
   * response carries only public metadata and its canonical reference.
   */
  static async storeTemporaryLogo(
    userId: string,
    file: File,
  ): Promise<MediaFilesModel["uploaded"]> {
    const image = await readImageUpload(file);
    const uuid = randomUUID();
    const stored = await MediaFilesService.persistImage(
      {
        uuid,
        storageKey: `${mediaPurpose.organizationLogo}/${uuid}.${image.kind}`,
        originalName: storedOriginalName(file.name, `image.${image.kind}`),
        contentType: image.contentType,
        byteSize: image.bytes.length,
        purpose: mediaPurpose.organizationLogo,
        status: mediaStatus.temporary,
        uploaderId: userId,
        organizationId: null,
        reference: null,
        expiresAt: new Date(Date.now() + temporaryLifetimeMs),
        claimedAt: null,
      },
      image.bytes,
    );
    return { ...stored, reference: canonicalLogoReference(stored.uuid) };
  }

  /**
   * Stores one verified avatar upload as a global, uploader-owned temporary
   * file and returns its canonical `/media/avatars/<uuid>` reference. No
   * organization is involved; the native user update trigger binds it to that
   * account and an unclaimed upload expires.
   */
  static async storeTemporaryAvatar(
    userId: string,
    file: File,
  ): Promise<MediaFilesModel["avatarUploaded"]> {
    const image = await readImageUpload(file);
    const uuid = randomUUID();
    const stored = await MediaFilesService.persistImage(
      {
        uuid,
        storageKey: `${mediaPurpose.userAvatar}/${uuid}.${image.kind}`,
        originalName: storedOriginalName(file.name, `avatar.${image.kind}`),
        contentType: image.contentType,
        byteSize: image.bytes.length,
        purpose: mediaPurpose.userAvatar,
        status: mediaStatus.temporary,
        uploaderId: userId,
        organizationId: null,
        reference: null,
        expiresAt: new Date(Date.now() + temporaryLifetimeMs),
        claimedAt: null,
      },
      image.bytes,
    );
    return { ...stored, reference: canonicalAvatarReference(stored.uuid) };
  }

  /**
   * Platform-admin target upload: the temporary row belongs to the target
   * account because the native avatar trigger claims only uploader-owned rows.
   * The caller must enforce platform-admin authority; this method validates
   * that the target account actually exists before any bytes or metadata are
   * written.
   */
  static async storeTemporaryAvatarForTarget(
    targetUserId: string,
    file: File,
  ): Promise<MediaFilesModel["avatarUploaded"]> {
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!target) throw new createError.NotFound("User not found");
    return MediaFilesService.storeTemporaryAvatar(targetUserId, file);
  }

  /**
   * Operational import for a historical logo: stores already verified bytes as
   * an unclaimed temporary file and returns its UUID. The caller replaces the
   * organization column only when it still holds the imported value; the
   * database trigger then claims the file in that same update. A conditional
   * miss is discarded through `discardImportedLogo`.
   */
  static async importTemporaryLogo(input: {
    originalName: string;
    image: VerifiedImage;
  }): Promise<string> {
    const uuid = randomUUID();
    await MediaFilesService.persistImage(
      {
        uuid,
        storageKey: `${mediaPurpose.organizationLogo}/${uuid}.${input.image.kind}`,
        originalName: input.originalName,
        contentType: input.image.contentType,
        byteSize: input.image.bytes.length,
        purpose: mediaPurpose.organizationLogo,
        status: mediaStatus.temporary,
        uploaderId: null,
        organizationId: null,
        reference: null,
        expiresAt: new Date(Date.now() + temporaryLifetimeMs),
        claimedAt: null,
      },
      input.image.bytes,
    );
    return uuid;
  }

  /** Drops one unclaimed imported logo after a conditional update miss. */
  static async discardImportedLogo(uuid: string): Promise<void> {
    await MediaFilesService.discardTemporary({
      uuid,
      purpose: mediaPurpose.organizationLogo,
      organizationId: null,
      uploaderId: null,
    });
  }

  /** Drops one failed batch-create workbook upload for the acting tenant. */
  static async discardWorkbook(
    actor: TenantActor,
    uuid: string,
  ): Promise<void> {
    await MediaFilesService.discardTemporary({
      uuid,
      purpose: mediaPurpose.salesWorkbook,
      organizationId: actor.organizationId,
      uploaderId: actor.userId,
    });
  }

  /** Only server-derived identity may mark an upload as abandoned. */
  private static async discardTemporary(input: {
    uuid: string;
    purpose: MediaPurpose;
    organizationId: string | null;
    uploaderId: string | null;
  }): Promise<void> {
    await prisma.mediaFile.updateMany({
      where: {
        uuid: input.uuid,
        purpose: input.purpose,
        organizationId: input.organizationId,
        uploaderId: input.uploaderId,
        status: mediaStatus.temporary,
        reference: null,
      },
      data: {
        status: mediaStatus.deleting,
        deleteStartedAt: new Date(Date.now() - deletionRetryDelayMs),
        expiresAt: new Date(),
      },
    });
  }

  /**
   * Create-time logo guard for the native organization hook. Only an absent
   * logo or this user's unclaimed, unexpired temporary logo is accepted;
   * data URIs, arbitrary URLs, and foreign references are rejected.
   */
  static async assertCreateLogo(
    userId: string,
    logo: string | null | undefined,
  ): Promise<void> {
    if (logo === undefined || logo === null || logo === "") return;
    const uuid = logoUuid(logo);
    if (uuid === null) throw invalidLogo();
    if (!claimableTemporary(await MediaFilesService.logoRow(uuid), userId))
      throw invalidLogo();
  }

  /**
   * Update-time logo guard for the native organization hook. An omitted logo
   * leaves the stored value untouched (the frontend omits an unchanged legacy
   * value instead of re-sending it). Any present value must be removal, this
   * user's claimable temporary logo, or a logo the same organization already
   * owns. Historical `data:` values are never accepted as input.
   */
  static async assertUpdateLogo(input: {
    userId: string;
    organizationId: string;
    logo: string | null | undefined;
  }): Promise<void> {
    const { userId, organizationId, logo } = input;
    if (logo === undefined) return;
    if (logo === null || logo === "") return;
    const uuid = logoUuid(logo);
    if (uuid === null) throw invalidLogo();
    const row = await MediaFilesService.logoRow(uuid);
    if (
      row !== null &&
      row.purpose === mediaPurpose.organizationLogo &&
      row.status === mediaStatus.attached &&
      row.organizationId === organizationId
    )
      return;
    if (claimableTemporary(row, userId)) return;
    throw invalidLogo();
  }

  /**
   * Guard for the native user `image` write. An omitted image leaves the
   * stored value untouched. Removal is allowed; a canonical avatar reference
   * must be the target account's own unexpired temporary upload or an avatar it
   * already owns; a non-canonical value is accepted only when it is exactly the
   * account's current value (an unrelated name update must not break a
   * historical external URL). New arbitrary URLs and base64 are rejected. The
   * database trigger repeats the authoritative check inside the native write.
   */
  static async assertAvatarUpdate(input: {
    targetId: string | null;
    image: unknown;
  }): Promise<void> {
    const { targetId, image } = input;
    if (image === undefined) return;
    if (image !== null && typeof image !== "string") throw invalidAvatar();
    if (image === null) return;
    const value = image;
    if (value.trim() === "") return;
    const uuid = avatarUuid(value);
    if (uuid !== null) {
      if (targetId === null) throw invalidAvatar();
      const row = await prisma.mediaFile.findUnique({
        where: { uuid },
        select: {
          purpose: true,
          status: true,
          uploaderId: true,
          organizationId: true,
          expiresAt: true,
        },
      });
      if (
        row !== null &&
        row.purpose === mediaPurpose.userAvatar &&
        row.organizationId === null &&
        row.uploaderId === targetId &&
        (row.status === mediaStatus.attached ||
          (row.status === mediaStatus.temporary &&
            row.expiresAt !== null &&
            row.expiresAt.getTime() > Date.now()))
      )
        return;
      throw invalidAvatar();
    }
    if (targetId === null) throw invalidAvatar();
    const current = await prisma.user.findUnique({
      where: { id: targetId },
      select: { image: true },
    });
    if (current !== null && current.image === value) return;
    throw invalidAvatar();
  }

  /**
   * Stores one verified image upload for an item or supplier as a temporary,
   * organization-scoped file owned by the caller, and returns the wire
   * reference that the domain row will store. Binding happens inside the
   * domain write transaction; an unclaimed upload expires.
   */
  static async storeTemporaryImage(
    actor: TenantActor,
    purpose: ImagePurpose,
    file: File,
  ): Promise<string> {
    const image = await readImageUpload(file);
    const uuid = randomUUID();
    await MediaFilesService.persistImage(
      {
        uuid,
        storageKey: `${purpose}/${uuid}.${image.kind}`,
        originalName: storedOriginalName(file.name, `image.${image.kind}`),
        contentType: image.contentType,
        byteSize: image.bytes.length,
        purpose,
        status: mediaStatus.temporary,
        uploaderId: actor.userId,
        organizationId: actor.organizationId,
        reference: null,
        expiresAt: new Date(Date.now() + temporaryLifetimeMs),
        claimedAt: null,
      },
      image.bytes,
    );
    return imageReference(purpose, uuid, image.kind);
  }

  /**
   * Stable single-target binding label for an image. The wire URL stays the
   * `/items/images/…` or `/supplier/images/…` reference, but ownership is
   * keyed by the owning record UUID, so another record cannot reuse an already
   * attached URL.
   */
  static imageBinding(purpose: ImagePurpose, targetUuid: string): string {
    return purpose === mediaPurpose.itemImage
      ? `item:${targetUuid}`
      : `supplier:${targetUuid}`;
  }

  /**
   * Binds one item/supplier image reference to its target record inside the
   * caller's transaction. The reference must be this organization's, this
   * uploader's, unexpired temporary file of the same purpose and kind; an
   * identical attached binding for the same target is idempotent, anything
   * else (including reusing another record's URL) is rejected. Single binding
   * ownership is enforced by the unique (organization, purpose, reference)
   * index over `item:<uuid>` / `supplier:<uuid>`.
   */
  static async claimImage(
    db: Database,
    actor: TenantActor,
    purpose: ImagePurpose,
    reference: string,
    targetUuid: string,
  ): Promise<void> {
    const parts = imageReferenceParts(purpose, reference);
    if (parts === null) throw invalidImage();
    await MediaFilesService.claim(db, {
      organizationId: actor.organizationId,
      uploaderId: actor.userId,
      purpose,
      uuid: parts.uuid,
      reference: MediaFilesService.imageBinding(purpose, targetUuid),
      contentType: imageContentTypes[parts.kind],
      storageKeySuffix: `.${parts.kind}`,
    });
  }

  /**
   * Releases the target record's image binding in the caller's transaction.
   * The reference is cleared so a replacement attachment for the same target
   * can be claimed under the unique constraint without waiting for cleanup.
   */
  static async releaseImage(
    db: Database,
    organizationId: string,
    purpose: ImagePurpose,
    targetUuid: string,
  ): Promise<void> {
    await MediaFilesService.release(
      db,
      organizationId,
      purpose,
      MediaFilesService.imageBinding(purpose, targetUuid),
    );
  }

  /**
   * Reads one item/supplier image for the tenant. Attached images are readable
   * by every same-organization member; a temporary upload is readable only by
   * the uploader while it is still unexpired, so previews survive a failed
   * domain save. The extension must match the verified content type.
   */
  static async serveImage(
    actor: TenantActor,
    purpose: ImagePurpose,
    fileName: string,
  ): Promise<{ path: string; contentType: string }> {
    const parts = imageFileParts(fileName);
    if (parts === null) throw new createError.NotFound("Image was not found");
    const file = await prisma.mediaFile.findFirst({
      where: {
        uuid: parts.uuid,
        purpose,
        organizationId: actor.organizationId,
        status: { in: [mediaStatus.attached, mediaStatus.temporary] },
      },
      select: {
        storageKey: true,
        contentType: true,
        status: true,
        uploaderId: true,
        expiresAt: true,
      },
    });
    if (
      file === null ||
      file.contentType !== imageContentTypes[parts.kind] ||
      !file.storageKey.endsWith(`.${parts.kind}`)
    )
      throw new createError.NotFound("Image was not found");
    if (file.status === mediaStatus.attached) return located(file);
    if (
      file.status === mediaStatus.temporary &&
      file.uploaderId === actor.userId &&
      file.expiresAt !== null &&
      file.expiresAt.getTime() > Date.now()
    )
      return located(file);
    throw new createError.NotFound("Image was not found");
  }

  /**
   * Stores one parsed workbook for the caller's organization as a temporary
   * file and returns its media UUID. `assertWorkbookFile` and the parser stay
   * in the sales module; this only persists the verified bytes.
   */
  static async storeTemporaryWorkbook(
    actor: TenantActor,
    originalNameValue: string,
    bytes: Uint8Array,
  ): Promise<string> {
    if (bytes.length === 0)
      throw new createError.BadRequest("The selected workbook is empty");
    const uuid = randomUUID();
    await MediaFilesService.persistImage(
      {
        uuid,
        storageKey: `${mediaPurpose.salesWorkbook}/${uuid}.xlsx`,
        originalName: storedOriginalName(originalNameValue, "workbook.xlsx"),
        contentType: workbookContentType,
        byteSize: bytes.length,
        purpose: mediaPurpose.salesWorkbook,
        status: mediaStatus.temporary,
        uploaderId: actor.userId,
        organizationId: actor.organizationId,
        reference: null,
        expiresAt: new Date(Date.now() + temporaryLifetimeMs),
        claimedAt: null,
      },
      bytes,
    );
    return uuid;
  }

  /**
   * Binds a workbook media UUID to its created sales batch inside the batch
   * creation transaction. Idempotent for the same binding; another
   * organization, uploader, purpose, or binding is rejected.
   */
  static async claimWorkbook(
    db: Database,
    actor: TenantActor,
    mediaUuid: string,
    batchUuid: string,
  ): Promise<void> {
    await MediaFilesService.claim(db, {
      organizationId: actor.organizationId,
      uploaderId: actor.userId,
      purpose: mediaPurpose.salesWorkbook,
      uuid: mediaUuid,
      reference: workbookReference(batchUuid),
      contentType: workbookContentType,
      storageKeySuffix: ".xlsx",
    });
  }

  /** Releases a deleted batch's workbook binding in the caller's transaction. */
  static async releaseWorkbook(
    db: Database,
    organizationId: string,
    batchUuid: string,
  ): Promise<void> {
    await MediaFilesService.release(
      db,
      organizationId,
      mediaPurpose.salesWorkbook,
      workbookReference(batchUuid),
    );
  }

  /** Reads the attached source workbook bytes for the tenant-protected routes. */
  static async readWorkbook(
    organizationId: string,
    batchUuid: string,
  ): Promise<Uint8Array> {
    const file = await prisma.mediaFile.findFirst({
      where: {
        organizationId,
        purpose: mediaPurpose.salesWorkbook,
        reference: workbookReference(batchUuid),
        status: mediaStatus.attached,
      },
      select: { storageKey: true },
    });
    if (file === null)
      throw new createError.NotFound("The stored workbook is missing");
    try {
      return await MediaService.read(file.storageKey);
    } catch (error) {
      if (isMissingFile(error))
        throw new createError.NotFound("The stored workbook is missing");
      throw error;
    }
  }

  /**
   * Operational import of an already stored, externally verified file. The
   * caller supplies the public identity and private key of an existing file;
   * no bytes are written here.
   */
  static async importAttached(input: {
    uuid: string;
    organizationId: string;
    purpose: MediaPurpose;
    reference: string;
    storageKey: string;
    originalName: string;
    contentType: string;
    byteSize: number;
  }): Promise<void> {
    await prisma.mediaFile.create({
      data: {
        uuid: input.uuid,
        storageKey: input.storageKey,
        originalName: input.originalName,
        contentType: input.contentType,
        byteSize: input.byteSize,
        purpose: input.purpose,
        status: mediaStatus.attached,
        organizationId: input.organizationId,
        uploaderId: null,
        reference: input.reference,
        expiresAt: null,
        claimedAt: new Date(),
      },
    });
  }

  /**
   * Resolves one organization logo by its public UUID. The purpose filter
   * keeps this active-organization-independent endpoint from serving any other
   * media kind. An attached logo needs live native membership of its owning
   * organization; an unclaimed temporary logo is readable only by its uploader
   * while unexpired.
   */
  static async serveLogo(
    userId: string,
    uuid: string,
  ): Promise<{ path: string; contentType: string }> {
    const file = await prisma.mediaFile.findFirst({
      where: {
        uuid,
        purpose: mediaPurpose.organizationLogo,
        status: { in: [mediaStatus.attached, mediaStatus.temporary] },
      },
      select: {
        storageKey: true,
        contentType: true,
        status: true,
        organizationId: true,
        uploaderId: true,
        expiresAt: true,
      },
    });
    if (!file) throw new createError.NotFound("Media file was not found");
    if (file.status === mediaStatus.attached && file.organizationId !== null) {
      await requireMembership(userId, file.organizationId);
      return located(file);
    }
    if (
      file.status === mediaStatus.temporary &&
      file.organizationId === null &&
      file.uploaderId === userId &&
      file.expiresAt !== null &&
      file.expiresAt.getTime() > Date.now()
    )
      return located(file);
    throw new createError.NotFound("Media file was not found");
  }

  /**
   * Resolves one account avatar. Attached avatars are readable by any active
   * signed-in account (the UI renders other accounts' avatars); an unclaimed
   * temporary avatar is readable by its uploader, or by a platform
   * administrator previewing a target upload, while unexpired. The purpose
   * filter keeps logo and business media out of this route.
   */
  static async serveAvatar(
    userId: string,
    uuid: string,
    platformAdministrator: boolean,
  ): Promise<{ path: string; contentType: string }> {
    const file = await prisma.mediaFile.findFirst({
      where: {
        uuid,
        purpose: mediaPurpose.userAvatar,
        organizationId: null,
        status: { in: [mediaStatus.attached, mediaStatus.temporary] },
      },
      select: {
        storageKey: true,
        contentType: true,
        status: true,
        uploaderId: true,
        expiresAt: true,
      },
    });
    if (!file) throw new createError.NotFound("Media file was not found");
    if (file.status === mediaStatus.attached) return located(file);
    if (
      file.expiresAt !== null &&
      file.expiresAt.getTime() > Date.now() &&
      (file.uploaderId === userId || platformAdministrator)
    )
      return located(file);
    throw new createError.NotFound("Media file was not found");
  }

  /**
   * Resolves one temporary logo for its uploader before the owning
   * organization exists. No other account can read an unclaimed upload, and an
   * expired temporary file is no longer readable here.
   */
  static async serveTemporaryLogo(
    userId: string,
    uuid: string,
  ): Promise<{ path: string; contentType: string }> {
    const file = await prisma.mediaFile.findFirst({
      where: {
        uuid,
        uploaderId: userId,
        purpose: mediaPurpose.organizationLogo,
        organizationId: null,
        status: mediaStatus.temporary,
        expiresAt: { gt: new Date() },
      },
      select: { storageKey: true, contentType: true },
    });
    if (!file) throw new createError.NotFound("Media file was not found");
    return located(file);
  }

  /**
   * Removes expired temporary files and retries failed deletions. The
   * candidate query returns only actionable rows and is ordered by the oldest
   * deletion attempt, so every pass makes progress without a cursor or a
   * resettable scan cap. Ownership of a row is taken by one conditional UPDATE
   * that also excludes any committed `organization.logo` reference; only the
   * winner unlinks the file. A native organization write and cleanup therefore
   * serialize on the row lock: the trigger only claims unexpired temporary
   * rows, cleanup only takes expired temporary or stale deleting rows, and a
   * losing side re-evaluates its predicate and does nothing.
   */
  static async cleanupExpired(options?: {
    limit?: number;
    now?: Date;
  }): Promise<{ scanned: number; deleted: number; failed: number }> {
    const now = options?.now ?? new Date();
    const retryBefore = new Date(now.getTime() - deletionRetryDelayMs);
    const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
    // Candidates come from one statement that returns only actionable rows a
    // live organization does not reference. Referenced rows can therefore
    // never occupy the page and starve the rest, and the oldest attempt is
    // served first; a failed deletion moves to the end of the queue.
    const rows = await prisma.$queryRaw<
      { id: number; storageKey: string; status: number }[]
    >`
      SELECT mf."id" AS "id",
             mf."storage_key" AS "storageKey",
             mf."status" AS "status"
      FROM "media_file" AS mf
      WHERE (
          (
            mf."status" = ${mediaStatus.temporary}
            AND mf."expires_at" IS NOT NULL
            AND mf."expires_at" <= ${now}
          )
          OR (
            mf."status" = ${mediaStatus.deleting}
            AND mf."delete_started_at" IS NOT NULL
            AND mf."delete_started_at" <= ${retryBefore}
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "organization" AS o
          WHERE o."logo" = ${logoReferencePrefix}::text || mf."uuid"::text
        )
      ORDER BY mf."delete_started_at" ASC NULLS FIRST, mf."id" ASC
      LIMIT ${limit}::bigint
    `;
    let deleted = 0;
    let failed = 0;
    for (const row of rows) {
      const owned =
        row.status === mediaStatus.temporary
          ? await MediaFilesService.ownExpiredTemporary(row.id, now)
          : await MediaFilesService.ownFailedDeletion(row.id, retryBefore, now);
      if (!owned) continue;
      try {
        await MediaService.remove(row.storageKey);
      } catch (error) {
        failed += 1;
        await MediaFilesService.recordDeleteFailure(row.id, error);
        continue;
      }
      try {
        await prisma.mediaFile.delete({ where: { id: row.id } });
        deleted += 1;
      } catch (error) {
        failed += 1;
        await MediaFilesService.recordDeleteFailure(row.id, error);
      }
    }
    return { scanned: rows.length, deleted, failed };
  }

  private static async claim(
    db: Database,
    input: {
      organizationId: string;
      uploaderId: string;
      purpose: MediaPurpose;
      uuid: string;
      reference: string;
      contentType: string;
      storageKeySuffix: string;
    },
  ): Promise<void> {
    const now = new Date();
    const claimed = await db.mediaFile.updateMany({
      where: {
        uuid: input.uuid,
        organizationId: input.organizationId,
        uploaderId: input.uploaderId,
        purpose: input.purpose,
        status: mediaStatus.temporary,
        expiresAt: { gt: now },
        contentType: input.contentType,
        storageKey: { endsWith: input.storageKeySuffix },
      },
      data: {
        status: mediaStatus.attached,
        reference: input.reference,
        claimedAt: now,
        expiresAt: null,
      },
    });
    if (claimed.count > 0) return;
    const existing = await db.mediaFile.findUnique({
      where: { uuid: input.uuid },
      select: {
        purpose: true,
        status: true,
        organizationId: true,
        reference: true,
        contentType: true,
        storageKey: true,
      },
    });
    if (
      existing !== null &&
      existing.purpose === input.purpose &&
      existing.status === mediaStatus.attached &&
      existing.organizationId === input.organizationId &&
      existing.reference === input.reference &&
      existing.contentType === input.contentType &&
      existing.storageKey.endsWith(input.storageKeySuffix)
    )
      return;
    throw new createError.BadRequest(
      "The file must be an uploaded temporary file of this organization",
    );
  }

  /** Releases one binding; bytes are removed later by deferred cleanup. */
  private static async release(
    db: Database,
    organizationId: string,
    purpose: MediaPurpose,
    reference: string,
  ): Promise<void> {
    await db.mediaFile.updateMany({
      where: {
        organizationId,
        purpose,
        status: mediaStatus.attached,
        reference,
      },
      data: {
        status: mediaStatus.deleting,
        deleteStartedAt: new Date(),
        expiresAt: new Date(),
        reference: null,
      },
    });
  }

  private static async logoRow(uuid: string): Promise<LogoRow | null> {
    return prisma.mediaFile.findUnique({
      where: { uuid },
      select: {
        purpose: true,
        status: true,
        uploaderId: true,
        organizationId: true,
        expiresAt: true,
      },
    });
  }

  /**
   * Takes ownership of one expired temporary row for deletion. The reference
   * exclusion is part of the same statement, so no organization can commit a
   * logo reference between the check and the status change.
   */
  private static async ownExpiredTemporary(
    id: number,
    now: Date,
  ): Promise<boolean> {
    const changed = await prisma.$executeRaw`
      UPDATE "media_file" AS mf
      SET "status" = ${mediaStatus.deleting},
          "delete_started_at" = ${now},
          "updated_at" = ${now}
      WHERE mf."id" = ${id}
        AND mf."status" = ${mediaStatus.temporary}
        AND mf."expires_at" IS NOT NULL
        AND mf."expires_at" <= ${now}
        AND NOT EXISTS (
          SELECT 1
          FROM "organization" AS o
          WHERE o."logo" = ${logoReferencePrefix}::text || mf."uuid"::text
        )
    `;
    return changed > 0;
  }

  /** Takes ownership of one stale deletion row for a retry, once it is due. */
  private static async ownFailedDeletion(
    id: number,
    retryBefore: Date,
    now: Date,
  ): Promise<boolean> {
    const changed = await prisma.$executeRaw`
      UPDATE "media_file" AS mf
      SET "delete_started_at" = ${now},
          "updated_at" = ${now}
      WHERE mf."id" = ${id}
        AND mf."status" = ${mediaStatus.deleting}
        AND mf."delete_started_at" IS NOT NULL
        AND mf."delete_started_at" <= ${retryBefore}
        AND NOT EXISTS (
          SELECT 1
          FROM "organization" AS o
          WHERE o."logo" = ${logoReferencePrefix}::text || mf."uuid"::text
        )
    `;
    return changed > 0;
  }

  /**
   * Indexes the bytes before writing them, so a failed write leaves cleanup
   * metadata instead of an untracked file. A failed write moves the row to
   * `deleting` immediately; cleanup then removes both the file and any staging
   * artifact.
   */
  private static async persistImage(
    data: {
      uuid: string;
      storageKey: string;
      originalName: string;
      contentType: string;
      byteSize: number;
      purpose: MediaPurpose;
      status: number;
      uploaderId: string | null;
      organizationId: string | null;
      reference: string | null;
      expiresAt: Date | null;
      claimedAt: Date | null;
    },
    bytes: Uint8Array,
  ): Promise<MediaFilesModel["file"]> {
    const record = await prisma.mediaFile.create({
      data,
      select: mediaFileColumns,
    });
    try {
      await MediaService.save(data.storageKey, bytes);
    } catch (error) {
      await prisma.mediaFile
        .update({
          where: { uuid: data.uuid },
          data: {
            status: mediaStatus.deleting,
            deleteStartedAt: new Date(Date.now() - deletionRetryDelayMs),
            expiresAt: new Date(),
            deleteAttempts: { increment: 1 },
            lastDeleteError: filesystemErrorCode(error),
          },
        })
        .catch(() => undefined);
      throw error;
    }
    return {
      uuid: record.uuid,
      purpose: data.purpose,
      contentType: record.contentType,
      byteSize: record.byteSize,
      originalName: record.originalName,
      createdAt: record.createdAt.toISOString(),
    };
  }

  private static async recordDeleteFailure(
    id: number,
    error: unknown,
  ): Promise<void> {
    const code = filesystemErrorCode(error);
    log({
      level: "warn",
      message: "Media cleanup could not delete a stored file",
      errorName: code,
    });
    await prisma.mediaFile
      .update({
        where: { id },
        data: { deleteAttempts: { increment: 1 }, lastDeleteError: code },
      })
      .catch(() => undefined);
  }
}

function invalidLogo(): createError.HttpError {
  return new createError.BadRequest(
    "The organization logo must be an uploaded temporary logo",
  );
}

function invalidImage(): createError.HttpError {
  return new createError.BadRequest(
    "The image must be an uploaded temporary image of this organization",
  );
}

function invalidAvatar(): createError.HttpError {
  return new createError.BadRequest(
    "The avatar must be an uploaded /media/avatars/<uuid> file owned by this account",
  );
}
