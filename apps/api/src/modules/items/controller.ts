import { Elysia } from "elysia";
import { authPlugin } from "../auth/plugin";
import { itemImagesController } from "./images/controller";
import { ItemsModel } from "./model";
import { ItemsService } from "./service";
import { itemStockController } from "./stock/controller";
import { itemTrackingController } from "./tracking/controller";

export const itemsController = new Elysia({ name: "items" })
  .use(authPlugin)
  .use(itemImagesController)
  .use(itemStockController)
  .use(itemTrackingController)
  .guard({
    tenant: true,
    detail: { tags: ["Items"], security: [{ cookieAuth: [] }] },
  })
  .get("/items/", ({ actor, query }) => ItemsService.index(actor, query), {
    query: ItemsModel.query,
    response: ItemsModel.list,
    detail: { summary: "List items" },
  })
  .get(
    "/items/:uuid",
    ({ actor, params }) => ItemsService.show(actor, params.uuid),
    {
      params: ItemsModel.params,
      response: ItemsModel.item,
      detail: { summary: "Item details" },
    },
  )
  .post(
    "/items/",
    ({ actor, body, set }) => {
      set.status = 201;
      return ItemsService.store(actor, body);
    },
    {
      body: ItemsModel.body,
      response: { 201: ItemsModel.item },
      detail: { summary: "Create an item" },
    },
  )
  .patch(
    "/items/:uuid",
    ({ actor, params, body }) => ItemsService.update(actor, params.uuid, body),
    {
      params: ItemsModel.params,
      body: ItemsModel.patch,
      response: ItemsModel.item,
      detail: { summary: "Update an item" },
    },
  )
  .delete(
    "/items/:uuid",
    ({ actor, params }) => ItemsService.destroy(actor, params.uuid),
    {
      params: ItemsModel.params,
      response: ItemsModel.success,
      detail: { summary: "Delete an item" },
    },
  );
