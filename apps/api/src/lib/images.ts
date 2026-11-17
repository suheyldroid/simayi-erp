import createError from "http-errors";

/**
 * Server-generated file name contract shared by every image upload: a UUID
 * with an allowlisted image extension. It guards both the canonical stored
 * reference and the serve route, so no client-supplied path reaches storage.
 */
export const imageFileNamePattern =
  "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(?:png|jpg|webp)$";

const fileNamePattern = new RegExp(imageFileNamePattern);

/**
 * The single image contract reused by every upload: PNG, JPEG, or WebP up to
 * 1 MB (1 MiB, 1024 × 1024 bytes inclusive). Both the declared size and the
 * actual bytes are checked, and the kind comes from the magic signature,
 * never from the client file name or MIME type.
 */
export const imageMaxBytes = 1024 * 1024;

export type ImageKind = "png" | "jpg" | "webp";

export const imageContentTypes: Record<ImageKind, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

export type VerifiedImage = {
  bytes: Uint8Array;
  kind: ImageKind;
  contentType: string;
};

function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "jpg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "webp";
  return null;
}

/**
 * Validates one image byte sequence. Every intake path (multipart upload and
 * the operational import) uses this instead of re-implementing the size,
 * signature, or error contract.
 */
export function verifyImageBytes(bytes: Uint8Array): VerifiedImage {
  if (bytes.length === 0)
    throw new createError.BadRequest("The selected image is empty");
  if (bytes.length > imageMaxBytes)
    throw new createError.PayloadTooLarge("Images must be 1 MB or smaller");
  const kind = detectImageKind(bytes);
  if (kind === null)
    throw new createError.UnsupportedMediaType(
      "Only PNG, JPEG, and WebP images are supported",
    );
  return { bytes, kind, contentType: imageContentTypes[kind] };
}

/**
 * Reads one multipart image and returns its verified bytes.
 */
export async function readImageUpload(file: File): Promise<VerifiedImage> {
  if (file.size === 0)
    throw new createError.BadRequest("The selected image is empty");
  if (file.size > imageMaxBytes)
    throw new createError.PayloadTooLarge("Images must be 1 MB or smaller");
  return verifyImageBytes(new Uint8Array(await file.arrayBuffer()));
}

function kindOf(fileName: string): ImageKind {
  if (fileName.endsWith(".png")) return "png";
  if (fileName.endsWith(".jpg")) return "jpg";
  return "webp";
}

/** UUID and verified kind from a server-generated stored file name. */
export function imageFileParts(
  fileName: string,
): { uuid: string; kind: ImageKind } | null {
  if (!fileNamePattern.test(fileName)) return null;
  return { uuid: fileName.slice(0, 36), kind: kindOf(fileName) };
}
