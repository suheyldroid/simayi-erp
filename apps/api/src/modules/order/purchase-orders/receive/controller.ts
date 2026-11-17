import { Elysia } from "elysia";
import { authPlugin } from "../../../auth/plugin";
import { ReceiveModel } from "./model";
import { ReceiveService } from "./service";

export const receiveController = new Elysia({
  name: "purchase-order-receive",
  prefix: "/order/purchase-orders/:uuid/receive",
})
  .use(authPlugin)
  .guard({
    tenant: true,
    detail: { tags: ["Purchase orders"], security: [{ cookieAuth: [] }] },
  })
  .post(
    "/",
    ({ actor, params, body }) =>
      ReceiveService.receive(actor, params.uuid, body),
    {
      params: ReceiveModel.params,
      body: ReceiveModel.body,
      response: ReceiveModel.created,
      detail: { summary: "Receive purchase order lines into branch stock" },
    },
  );

export const receiptsController = new Elysia({
  name: "purchase-order-receipts",
  prefix: "/order/purchase-orders/:uuid/receipts",
})
  .use(authPlugin)
  .guard({
    tenant: true,
    detail: { tags: ["Purchase orders"], security: [{ cookieAuth: [] }] },
  })
  .get(
    "/",
    ({ actor, params, query }) =>
      ReceiveService.index(actor, params.uuid, query),
    {
      params: ReceiveModel.params,
      query: ReceiveModel.query,
      response: ReceiveModel.list,
      detail: { summary: "List immutable purchase receipt events" },
    },
  )
  .post(
    "/:receiptUuid/reverse",
    ({ actor, params, body }) =>
      ReceiveService.reverse(actor, params.uuid, params.receiptUuid, body),
    {
      params: ReceiveModel.receiptParams,
      body: ReceiveModel.reverseBody,
      response: ReceiveModel.reversed,
      detail: {
        summary: "Reverse one purchase receipt with a compensating event",
      },
    },
  );
