import { Elysia } from "elysia";
import { authPlugin } from "../../auth/plugin";
import { ItemImagesModel } from "./model";
import { ItemImagesService } from "./service";

export const itemImagesController = new Elysia({
  name: "item-images",
  prefix: "/items/images",
})
  .use(authPlugin)
  .guard({
    tenant: true,
    detail: { tags: ["Items"], security: [{ cookieAuth: [] }] },
  })
  .post(
    "/",
    ({ actor, body, set }) => {
      set.status = 201;
      return ItemImagesService.store(actor, body.image);
    },
    {
      body: ItemImagesModel.body,
      response: { 201: ItemImagesModel.upload },
      detail: { summary: "Upload an item image" },
    },
  )
  .get(
    "/:fileName",
    async ({ actor, params }) => {
      const { path, contentType } = await ItemImagesService.show(
        actor,
        params.fileName,
      );
      return new Response(Bun.file(path), {
        headers: {
          "content-type": contentType,
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      });
    },
    {
      params: ItemImagesModel.params,
      detail: { summary: "Read an item image" },
    },
  );
