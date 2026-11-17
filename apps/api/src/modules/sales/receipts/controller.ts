import { Elysia } from "elysia";
import { authPlugin } from "../../auth/plugin";
import { ReceiptsModel } from "./model";
import { ReceiptService } from "./service";

export const receiptsController = new Elysia({
  name: "sale-receipts",
  prefix: "/sales/:uuid/receipts",
})
  .use(authPlugin)
  .guard({
    tenant: true,
    detail: { tags: ["Sales"], security: [{ cookieAuth: [] }] },
  })
  .post(
    "/",
    ({ actor, params, body, set }) => {
      set.status = 201;
      return ReceiptService.store(actor, params.uuid, body);
    },
    {
      params: ReceiptsModel.params,
      body: ReceiptsModel.body,
      response: { 201: ReceiptsModel.sale },
      detail: {
        summary:
          "Record a partial or full receipt against a priced sale's outstanding amount",
      },
    },
  );
