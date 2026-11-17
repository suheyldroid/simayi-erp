import { Elysia } from "elysia";
import { authPlugin } from "../../auth/plugin";
import { SupplierImagesModel } from "./model";
import { SupplierImagesService } from "./service";

export const supplierImagesController = new Elysia({
  name: "supplier-images",
  prefix: "/supplier/images",
})
  .use(authPlugin)
  .guard({
    tenant: true,
    detail: { tags: ["Suppliers"], security: [{ cookieAuth: [] }] },
  })
  .post(
    "/",
    ({ actor, body, set }) => {
      set.status = 201;
      return SupplierImagesService.store(actor, body.image);
    },
    {
      body: SupplierImagesModel.body,
      response: { 201: SupplierImagesModel.upload },
      detail: { summary: "Upload a supplier image" },
    },
  )
  .get(
    "/:fileName",
    async ({ actor, params }) => {
      const { path, contentType } = await SupplierImagesService.show(
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
      params: SupplierImagesModel.params,
      detail: { summary: "Read a supplier image" },
    },
  );
