import { Elysia } from "elysia";
import { authPlugin } from "../auth/plugin";
import { CurrenciesModel } from "./model";
import { CurrenciesService } from "./service";

export const currenciesController = new Elysia({ name: "currencies" })
  .use(authPlugin)
  .guard({
    auth: true,
    detail: { tags: ["Currencies"], security: [{ cookieAuth: [] }] },
  })
  .get("/currencies", () => CurrenciesService.index(), {
    response: CurrenciesModel.currencies,
    detail: { summary: "List supported currencies" },
  });
