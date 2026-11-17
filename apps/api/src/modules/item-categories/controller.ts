import { Elysia } from "elysia";
import { authPlugin } from "../auth/plugin";
import { ItemCategoriesModel } from "./model";
import { ItemCategoriesService } from "./service";

export const itemCategoriesController = new Elysia({
  name: "item-categories",
})
  .use(authPlugin)
  .guard({
    tenant: true,
    detail: { tags: ["Item categories"], security: [{ cookieAuth: [] }] },
  })
  .get(
    "/item-categories/",
    ({ actor, query }) => ItemCategoriesService.index(actor, query),
    {
      query: ItemCategoriesModel.query,
      response: ItemCategoriesModel.list,
      detail: { summary: "List item categories" },
    },
  )
  .get(
    "/item-categories/:uuid",
    ({ actor, params }) => ItemCategoriesService.show(actor, params.uuid),
    {
      params: ItemCategoriesModel.params,
      response: ItemCategoriesModel.category,
      detail: { summary: "Item category details" },
    },
  )
  .post(
    "/item-categories/",
    ({ actor, body, set }) => {
      set.status = 201;
      return ItemCategoriesService.store(actor, body);
    },
    {
      body: ItemCategoriesModel.body,
      response: { 201: ItemCategoriesModel.category },
      detail: { summary: "Create an item category" },
    },
  )
  .patch(
    "/item-categories/:uuid",
    ({ actor, params, body }) =>
      ItemCategoriesService.update(actor, params.uuid, body),
    {
      params: ItemCategoriesModel.params,
      body: ItemCategoriesModel.patch,
      response: ItemCategoriesModel.category,
      detail: { summary: "Update an item category" },
    },
  )
  .delete(
    "/item-categories/:uuid",
    ({ actor, params }) => ItemCategoriesService.destroy(actor, params.uuid),
    {
      params: ItemCategoriesModel.params,
      response: ItemCategoriesModel.success,
      detail: { summary: "Delete an item category" },
    },
  );
