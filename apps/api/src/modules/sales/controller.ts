import { Elysia } from "elysia";
import { authPlugin } from "../auth/plugin";
import { salesBatchesController } from "./batches/controller";
import { salesChannelsController } from "./channels/controller";
import { receiptsController } from "./receipts/controller";
import { SalesModel } from "./model";
import { SalesService } from "./service";

export const salesController = new Elysia({ name: "sales" })
  .use(authPlugin)
  .use(salesBatchesController)
  .use(salesChannelsController)
  .use(receiptsController)
  .guard({
    tenant: true,
    detail: { tags: ["Sales"], security: [{ cookieAuth: [] }] },
  })
  .get("/sales/", ({ actor, query }) => SalesService.index(actor, query), {
    query: SalesModel.query,
    response: SalesModel.list,
    detail: { summary: "List recorded sales" },
  })
  .post(
    "/sales/",
    ({ actor, body, set }) => {
      set.status = 201;
      return SalesService.store(actor, body);
    },
    {
      body: SalesModel.body,
      response: { 201: SalesModel.sale },
      detail: { summary: "Record a sale and consume its recipe stock" },
    },
  )
  .get(
    "/sales/:uuid",
    ({ actor, params }) => SalesService.show(actor, params.uuid),
    {
      params: SalesModel.params,
      response: SalesModel.sale,
      detail: { summary: "Recorded sale details" },
    },
  );
