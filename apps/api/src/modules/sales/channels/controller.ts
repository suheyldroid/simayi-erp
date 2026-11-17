import { Elysia } from "elysia";
import { authPlugin } from "../../auth/plugin";
import { SalesChannelsModel } from "./model";
import { SalesChannelsService } from "./service";

export const salesChannelsController = new Elysia({
  name: "sales-channels",
  prefix: "/sales/channels",
})
  .use(authPlugin)
  .guard({
    tenant: true,
    detail: { tags: ["Sales"], security: [{ cookieAuth: [] }] },
  })
  .get("/", ({ actor, query }) => SalesChannelsService.index(actor, query), {
    query: SalesChannelsModel.query,
    response: SalesChannelsModel.list,
    detail: { summary: "List sales channels" },
  })
  .post(
    "/",
    ({ actor, body, set }) => {
      set.status = 201;
      return SalesChannelsService.store(actor, body);
    },
    {
      body: SalesChannelsModel.body,
      response: { 201: SalesChannelsModel.channel },
      detail: { summary: "Create a sales channel" },
    },
  )
  .patch(
    "/:uuid",
    ({ actor, params, body }) =>
      SalesChannelsService.update(actor, params.uuid, body),
    {
      params: SalesChannelsModel.params,
      body: SalesChannelsModel.patch,
      response: SalesChannelsModel.channel,
      detail: { summary: "Rename or deactivate a sales channel" },
    },
  );
