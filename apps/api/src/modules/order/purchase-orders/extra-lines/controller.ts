import { Elysia } from "elysia";
import { authPlugin } from "../../../auth/plugin";
import { ExtraLinesModel } from "./model";
import { ExtraLinesService } from "./service";

export const extraLinesController = new Elysia({
  name: "purchase-order-extra-lines",
  prefix: "/order/purchase-orders/:uuid/extra-lines",
})
  .use(authPlugin)
  .guard({
    tenant: true,
    detail: { tags: ["Purchase orders"], security: [{ cookieAuth: [] }] },
  })
  .get(
    "/",
    ({ actor, params, query }) =>
      ExtraLinesService.index(actor, params.uuid, query),
    {
      params: ExtraLinesModel.params,
      query: ExtraLinesModel.query,
      response: ExtraLinesModel.list,
      detail: { summary: "List purchase order extra lines" },
    },
  )
  .post(
    "/",
    ({ actor, params, body, set }) => {
      set.status = 201;
      return ExtraLinesService.store(actor, params.uuid, body);
    },
    {
      params: ExtraLinesModel.params,
      body: ExtraLinesModel.body,
      response: { 201: ExtraLinesModel.line },
      detail: { summary: "Add a purchase order extra line" },
    },
  )
  .patch(
    "/:lineUuid",
    ({ actor, params, body }) =>
      ExtraLinesService.update(actor, params.uuid, params.lineUuid, body),
    {
      params: ExtraLinesModel.itemParams,
      body: ExtraLinesModel.patch,
      response: ExtraLinesModel.line,
      detail: { summary: "Update a purchase order extra line" },
    },
  )
  .delete(
    "/:lineUuid",
    ({ actor, params, query }) =>
      ExtraLinesService.destroy(
        actor,
        params.uuid,
        params.lineUuid,
        query.version,
      ),
    {
      params: ExtraLinesModel.itemParams,
      query: ExtraLinesModel.removeQuery,
      response: ExtraLinesModel.success,
      detail: { summary: "Delete a purchase order extra line" },
    },
  );
