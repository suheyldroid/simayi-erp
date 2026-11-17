import { Elysia } from "elysia";
import { purchaseOrdersController } from "./purchase-orders/controller";

export const orderController = new Elysia({ name: "order" }).use(
  purchaseOrdersController,
);
