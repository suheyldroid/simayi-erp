import { Elysia } from "elysia";
import { authPlugin } from "../auth/plugin";
import { supplierImagesController } from "./images/controller";
import { SupplierModel } from "./model";
import { SupplierService } from "./service";

export const supplierController = new Elysia({ name: "supplier" })
  .use(authPlugin)
  .use(supplierImagesController)
  .guard({
    tenant: true,
    detail: { tags: ["Suppliers"], security: [{ cookieAuth: [] }] },
  })
  .get(
    "/supplier/",
    ({ actor, query }) => SupplierService.index(actor, query),
    {
      query: SupplierModel.query,
      response: SupplierModel.list,
      detail: { summary: "List suppliers" },
    },
  )
  .get(
    "/supplier/:uuid",
    ({ actor, params }) => SupplierService.show(actor, params.uuid),
    {
      params: SupplierModel.params,
      response: SupplierModel.supplier,
      detail: { summary: "Supplier details" },
    },
  )
  .post(
    "/supplier/",
    ({ actor, body, set }) => {
      set.status = 201;
      return SupplierService.store(actor, body);
    },
    {
      body: SupplierModel.body,
      response: { 201: SupplierModel.supplier },
      detail: { summary: "Create supplier" },
    },
  )
  .patch(
    "/supplier/:uuid",
    ({ actor, params, body }) =>
      SupplierService.update(actor, params.uuid, body),
    {
      params: SupplierModel.params,
      body: SupplierModel.patch,
      response: SupplierModel.supplier,
      detail: { summary: "Update supplier" },
    },
  )
  .delete(
    "/supplier/:uuid",
    ({ actor, params }) => SupplierService.destroy(actor, params.uuid),
    {
      params: SupplierModel.params,
      response: SupplierModel.success,
      detail: { summary: "Delete supplier" },
    },
  );
