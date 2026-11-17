import { t, type UnwrapSchema } from "elysia";
import { imageFileNamePattern } from "@/lib/images";

/**
 * Upload and read contract for supplier images. The upload response is the
 * canonical stored reference within the 100-character `Supplier.image` bound.
 */
export const SupplierImagesModel = {
  params: t.Object(
    {
      fileName: t.String({
        pattern: imageFileNamePattern,
        maxLength: 41,
      }),
    },
    { additionalProperties: false },
  ),
  body: t.Object(
    {
      image: t.File({
        description: "PNG, JPEG, or WebP image up to 1 MB",
      }),
    },
    { additionalProperties: false },
  ),
  upload: t.Object(
    {
      image: t.String({
        pattern: `^/supplier/images/${imageFileNamePattern.slice(1)}`,
        maxLength: 100,
      }),
    },
    { additionalProperties: false },
  ),
} as const;

export type SupplierImagesModel = {
  [K in keyof typeof SupplierImagesModel]: UnwrapSchema<
    (typeof SupplierImagesModel)[K]
  >;
};
