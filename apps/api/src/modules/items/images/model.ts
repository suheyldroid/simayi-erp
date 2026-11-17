import { t, type UnwrapSchema } from "elysia";
import { imageFileNamePattern } from "@/lib/images";

export const ItemImagesModel = {
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
        pattern: `^/items/images/${imageFileNamePattern.slice(1)}`,
        maxLength: 100,
      }),
    },
    { additionalProperties: false },
  ),
} as const;

export type ItemImagesModel = {
  [K in keyof typeof ItemImagesModel]: UnwrapSchema<
    (typeof ItemImagesModel)[K]
  >;
};
