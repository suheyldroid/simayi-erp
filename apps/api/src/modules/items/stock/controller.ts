import { Elysia } from "elysia";
import { authPlugin } from "../../auth/plugin";
import { StockModel } from "./model";
import { StockService } from "./service";

export const itemStockController = new Elysia({
  name: "item-stock",
  prefix: "/stock",
})
  .use(authPlugin)
  .guard({
    tenant: true,
    detail: { tags: ["Stock"], security: [{ cookieAuth: [] }] },
  })
  .get("/", ({ actor, query }) => StockService.index(actor, query), {
    query: StockModel.query,
    response: StockModel.list,
    detail: {
      summary:
        "List item balances in the selected branch or, without a branch, across every company branch",
    },
  })
  .get("/:uuid", ({ actor, params }) => StockService.show(actor, params.uuid), {
    params: StockModel.params,
    response: StockModel.balance,
    detail: { summary: "One item's balance in the selected branch" },
  })
  .patch(
    "/:uuid",
    ({ actor, params, body }) => StockService.minimum(actor, params.uuid, body),
    {
      params: StockModel.params,
      body: StockModel.minimum,
      response: StockModel.balance,
      detail: { summary: "Change the branch minimum stock of an item" },
    },
  )
  .post(
    "/:uuid/add",
    ({ actor, params, body }) =>
      StockService.adjust(actor, params.uuid, "add", body),
    {
      params: StockModel.params,
      body: StockModel.body,
      response: StockModel.balance,
      detail: { summary: "Add stock to an item in the selected branch" },
    },
  )
  .post(
    "/:uuid/remove",
    ({ actor, params, body }) =>
      StockService.adjust(actor, params.uuid, "remove", body),
    {
      params: StockModel.params,
      body: StockModel.body,
      response: StockModel.balance,
      detail: { summary: "Remove stock from an item in the selected branch" },
    },
  )
  .post(
    "/:uuid/count",
    ({ actor, params, body }) =>
      StockService.adjust(actor, params.uuid, "count", body),
    {
      params: StockModel.params,
      body: StockModel.body,
      response: StockModel.balance,
      detail: { summary: "Count an item's branch stock" },
    },
  );
