import { Elysia } from "elysia";
import { authPlugin } from "../../../auth/plugin";
import { LinesModel } from "./model";
import { LinesService } from "./service";

export const linesController = new Elysia({
  name: "purchase-order-lines",
  prefix: "/order/purchase-orders/:uuid/lines",
})
  .use(authPlugin)
  .guard({
    tenant: true,
    detail: { tags: ["Purchase orders"], security: [{ cookieAuth: [] }] },
  })
  .get(
    "/",
    ({ actor, params, query }) => LinesService.index(actor, params.uuid, query),
    {
      params: LinesModel.params,
      query: LinesModel.query,
      response: LinesModel.list,
      detail: { summary: "List purchase order lines" },
    },
  )
  .post(
    "/",
    ({ actor, params, body, set }) => {
      set.status = 201;
      return LinesService.store(actor, params.uuid, body);
    },
    {
      params: LinesModel.params,
      body: LinesModel.body,
      response: { 201: LinesModel.line },
      detail: { summary: "Add a purchase order line" },
    },
  )
  .patch(
    "/:lineUuid",
    ({ actor, params, body }) =>
      LinesService.update(actor, params.uuid, params.lineUuid, body),
    {
      params: LinesModel.itemParams,
      body: LinesModel.patch,
      response: LinesModel.line,
      detail: { summary: "Update a purchase order line" },
    },
  )
  .delete(
    "/:lineUuid",
    ({ actor, params, query }) =>
      LinesService.destroy(actor, params.uuid, params.lineUuid, query.version),
    {
      params: LinesModel.itemParams,
      query: LinesModel.removeQuery,
      response: LinesModel.success,
      detail: { summary: "Delete a purchase order line" },
    },
  );
