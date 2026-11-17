import { t, type UnwrapSchema } from "elysia";
import type {
  Prisma,
  PrismaClient,
} from "../../../prisma/generated/prisma/client";
import { MediaFilePlain } from "../../../prisma/generated/typebox/MediaFile";
import { resourceUuid } from "@/lib/dto";

/** A transaction client for bindings made inside a domain write. */
export type Database = Prisma.TransactionClient | PrismaClient;

/**
 * Explicit media use cases. There is no generic association table: every
 * purpose names one business surface that owns its binding.
 */
export const mediaPurpose = {
  organizationLogo: "organization-logo",
  itemImage: "item-image",
  supplierImage: "supplier-image",
  salesWorkbook: "sales-batch-workbook",
  userAvatar: "user-avatar",
} as const;

export type MediaPurpose = (typeof mediaPurpose)[keyof typeof mediaPurpose];

/** The purposes rendered through the item/supplier image routes. */
export type ImagePurpose =
  typeof mediaPurpose.itemImage | typeof mediaPurpose.supplierImage;

/**
 * Stored lifecycle status. A row starts temporary and later becomes attached
 * (claimed) or deleting (deferred cleanup), never both.
 */
export const mediaStatus = {
  temporary: 10,
  attached: 20,
  deleting: 30,
} as const;

/**
 * The one public form of a stored logo. Native `organization.logo` and every
 * HTTP response carry exactly this reference; the disk key, the internal id,
 * and any other string are never accepted as a logo value.
 */
export const logoReferencePrefix = "/media/";

export const logoReferencePattern = `${logoReferencePrefix}[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`;

/**
 * Account avatars use their own prefix so the logo endpoint never serves them
 * and the profile editor can recognize them without a tenant.
 */
export const avatarReferencePrefix = "/media/avatars/";

export const avatarReferencePattern = `${avatarReferencePrefix}[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`;

const purpose = t.Union([
  t.Literal(mediaPurpose.organizationLogo),
  t.Literal(mediaPurpose.itemImage),
  t.Literal(mediaPurpose.supplierImage),
  t.Literal(mediaPurpose.salesWorkbook),
  t.Literal(mediaPurpose.userAvatar),
]);

/**
 * Public projection. The storage key, integer id, uploader, and lifecycle
 * fields stay inside the service, so no response can leak an internal path.
 */
export const mediaFileColumns = {
  uuid: true,
  purpose: true,
  contentType: true,
  byteSize: true,
  originalName: true,
  createdAt: true,
} as const satisfies Prisma.MediaFileSelect;

const file = t.Object(
  {
    uuid: resourceUuid,
    purpose,
    contentType: MediaFilePlain.properties.contentType,
    byteSize: { ...MediaFilePlain.properties.byteSize, minimum: 1 },
    originalName: MediaFilePlain.properties.originalName,
    createdAt: MediaFilePlain.properties.createdAt,
  },
  { additionalProperties: false },
);

const reference = t.String({ pattern: logoReferencePattern, maxLength: 43 });
const avatarReference = t.String({
  pattern: avatarReferencePattern,
  maxLength: 51,
});

export const MediaFilesModel = {
  file,
  params: t.Object({ uuid: resourceUuid }, { additionalProperties: false }),
  targetParams: t.Object(
    { userId: t.String({ minLength: 1, maxLength: 128 }) },
    { additionalProperties: false },
  ),
  upload: t.Object(
    {
      image: t.File({
        description: "PNG, JPEG, or WebP organization logo up to 1 MB",
      }),
    },
    { additionalProperties: false },
  ),
  uploaded: t.Object(
    {
      ...file.properties,
      reference,
    },
    { additionalProperties: false },
  ),
  avatarUpload: t.Object(
    {
      image: t.File({
        description: "PNG, JPEG, or WebP account avatar up to 1 MB",
      }),
    },
    { additionalProperties: false },
  ),
  avatarUploaded: t.Object(
    {
      ...file.properties,
      reference: avatarReference,
    },
    { additionalProperties: false },
  ),
} as const;

export type MediaFilesModel = {
  [K in keyof typeof MediaFilesModel]: UnwrapSchema<
    (typeof MediaFilesModel)[K]
  >;
};
