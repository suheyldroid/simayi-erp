import { Elysia } from "elysia";
import { authPlugin } from "../../auth/plugin";
import { SupplierLedgerModel } from "./model";
import { SupplierLedgerService } from "./service";

export const supplierLedgerController = new Elysia({
  name: "supplier-ledger",
  prefix: "/supplier/:uuid",
})
  .use(authPlugin)
  .guard({
    tenant: true,
    detail: { tags: ["Finance"], security: [{ cookieAuth: [] }] },
  })
  .get(
    "/ledger/",
    ({ actor, params, query }) =>
      SupplierLedgerService.index(actor, params.uuid, query),
    {
      params: SupplierLedgerModel.params,
      query: SupplierLedgerModel.query,
      response: SupplierLedgerModel.ledger,
      detail: { summary: "Paginated supplier ledger and outstanding balance" },
    },
  )
  .post(
    "/payments/",
    ({ actor, params, body, set }) => {
      set.status = 201;
      return SupplierLedgerService.storePayment(actor, params.uuid, body);
    },
    {
      params: SupplierLedgerModel.params,
      body: SupplierLedgerModel.positiveMoneyBody,
      response: { 201: SupplierLedgerModel.entry },
      detail: {
        summary: "Pay a supplier: cash outflow plus the same debt reduction",
      },
    },
  );
