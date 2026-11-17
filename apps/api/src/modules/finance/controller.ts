import { Elysia } from "elysia";
import { authPlugin } from "../auth/plugin";
import { FinanceModel } from "./model";
import { FinanceService } from "./service";
import { supplierLedgerController } from "./suppliers/controller";

export const financeController = new Elysia({ name: "finance" })
  .use(authPlugin)
  .use(supplierLedgerController)
  .guard({
    tenant: true,
    detail: { tags: ["Finance"], security: [{ cookieAuth: [] }] },
  })
  .get("/finance/", ({ actor }) => FinanceService.summary(actor), {
    response: FinanceModel.summary,
    detail: {
      summary: "Organization finance currency and exact cash balance",
    },
  })
  .get(
    "/finance/movements/",
    ({ actor, query }) => FinanceService.index(actor, query),
    {
      query: FinanceModel.query,
      response: FinanceModel.list,
      detail: { summary: "List posted money movements" },
    },
  )
  .get(
    "/finance/movements/:uuid",
    ({ actor, params }) => FinanceService.show(actor, params.uuid),
    {
      params: FinanceModel.params,
      response: FinanceModel.movement,
      detail: { summary: "Money movement details" },
    },
  )
  .post(
    "/finance/income/",
    ({ actor, body, set }) => {
      set.status = 201;
      return FinanceService.income(actor, body);
    },
    {
      body: FinanceModel.positiveMoneyBody,
      response: { 201: FinanceModel.movement },
      detail: { summary: "Record general income as a cash inflow" },
    },
  )
  .post(
    "/finance/expense/",
    ({ actor, body, set }) => {
      set.status = 201;
      return FinanceService.expense(actor, body);
    },
    {
      body: FinanceModel.positiveMoneyBody,
      response: { 201: FinanceModel.movement },
      detail: { summary: "Record a general expense as a cash outflow" },
    },
  )
  .post(
    "/finance/movements/:uuid/reverse",
    ({ actor, params }) => FinanceService.reverse(actor, params.uuid),
    {
      params: FinanceModel.params,
      response: FinanceModel.movement,
      detail: {
        summary:
          "Reverse one posted entry once; a supplier payment reverses both sides",
      },
    },
  );
