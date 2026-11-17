import { Elysia } from "elysia";
import { authPlugin } from "../../auth/plugin";
import { OrderModel } from "../model";
import { extraLinesController } from "./extra-lines/controller";
import { linesController } from "./lines/controller";
import { PurchaseOrdersModel } from "./model";
import { receiptsController, receiveController } from "./receive/controller";
import { PurchaseOrdersService } from "./service";

export const purchaseOrdersController = new Elysia({ name: "purchase-orders" })
  .use(authPlugin)
  .guard({
    tenant: true,
    detail: { tags: ["Purchase orders"], security: [{ cookieAuth: [] }] },
  })
  .use(linesController)
  .use(extraLinesController)
  .use(receiveController)
  .use(receiptsController)
  .get(
    "/order/purchase-orders/",
    ({ actor, query }) => PurchaseOrdersService.index(actor, query),
    {
      query: PurchaseOrdersModel.query,
      response: PurchaseOrdersModel.list,
      detail: { summary: "List purchase orders" },
    },
  )
  .post(
    "/order/purchase-orders/",
    ({ actor, body, set }) => {
      set.status = 201;
      return PurchaseOrdersService.store(actor, body);
    },
    {
      body: PurchaseOrdersModel.body,
      response: { 201: PurchaseOrdersModel.order },
      detail: { summary: "Create a purchase order" },
    },
  )
  .get(
    "/order/purchase-orders/:uuid",
    ({ actor, params }) => PurchaseOrdersService.show(actor, params.uuid),
    {
      params: PurchaseOrdersModel.params,
      response: PurchaseOrdersModel.order,
      detail: { summary: "Purchase order details" },
    },
  )
  .patch(
    "/order/purchase-orders/:uuid",
    ({ actor, params, body }) =>
      PurchaseOrdersService.update(actor, params.uuid, body),
    {
      params: PurchaseOrdersModel.params,
      body: PurchaseOrdersModel.patch,
      response: PurchaseOrdersModel.order,
      detail: { summary: "Update a purchase order" },
    },
  )
  .post(
    "/order/purchase-orders/:uuid/place",
    ({ actor, params, body }) =>
      PurchaseOrdersService.place(actor, params.uuid, body.version),
    {
      params: PurchaseOrdersModel.params,
      body: OrderModel.versionBody,
      response: PurchaseOrdersModel.order,
      detail: { summary: "Place a purchase order" },
    },
  )
  .post(
    "/order/purchase-orders/:uuid/hold",
    ({ actor, params, body }) =>
      PurchaseOrdersService.hold(actor, params.uuid, body.version),
    {
      params: PurchaseOrdersModel.params,
      body: OrderModel.versionBody,
      response: PurchaseOrdersModel.order,
      detail: { summary: "Hold a purchase order" },
    },
  )
  .post(
    "/order/purchase-orders/:uuid/cancel",
    ({ actor, params, body }) =>
      PurchaseOrdersService.cancel(actor, params.uuid, body.version),
    {
      params: PurchaseOrdersModel.params,
      body: OrderModel.versionBody,
      response: PurchaseOrdersModel.order,
      detail: { summary: "Cancel a purchase order" },
    },
  )
  .post(
    "/order/purchase-orders/:uuid/complete",
    ({ actor, params, body }) =>
      PurchaseOrdersService.complete(actor, params.uuid, body),
    {
      params: PurchaseOrdersModel.params,
      body: PurchaseOrdersModel.completeBody,
      response: PurchaseOrdersModel.order,
      detail: { summary: "Complete a purchase order" },
    },
  );
