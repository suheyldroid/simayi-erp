import { Elysia } from "elysia";
import { authPlugin } from "../../auth/plugin";
import { TrackingModel } from "./model";
import { TrackingService } from "./service";

export const itemTrackingController = new Elysia({
  name: "item-tracking",
  prefix: "/items/:uuid/tracking",
})
  .use(authPlugin)
  .guard({
    tenant: true,
    detail: { tags: ["Stock tracking"], security: [{ cookieAuth: [] }] },
  })
  .get(
    "/",
    ({ actor, params, query }) =>
      TrackingService.index(actor, params.uuid, query),
    {
      params: TrackingModel.params,
      query: TrackingModel.query,
      response: TrackingModel.list,
      detail: { summary: "List item stock history" },
    },
  );
