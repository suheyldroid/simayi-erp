import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { trustedOrigins } from "./lib/env";
import { authController } from "./modules/auth/controller";
import { branchesController } from "./modules/branches/controller";
import { currenciesController } from "./modules/currencies/controller";
import { dashboardController } from "./modules/dashboard/controller";
import { financeController } from "./modules/finance/controller";
import { salesController } from "./modules/sales/controller";
import { itemCategoriesController } from "./modules/item-categories/controller";
import { itemsController } from "./modules/items/controller";
import { mediaController } from "./modules/media/controller";
import { orderController } from "./modules/order/controller";
import { posDevicesController } from "./modules/pos-devices/controller";
import { recipesController } from "./modules/recipes/controller";
import { supplierController } from "./modules/supplier/controller";
import { systemPreferencesController } from "./modules/system-preferences/controller";
import { unitsController } from "./modules/units/controller";
import { usersController } from "./modules/users/controller";
import { errorPlugin } from "./plugins/error";
import { openapiPlugin } from "./plugins/openapi";
import { requestLogPlugin } from "./plugins/request-log";

// Workbook uploads are bounded at 10 MB by the sales batch service. The
// transport limit must exceed that so a too-large file is rejected with the
// documented 413 instead of failing at the HTTP layer.
const maximumWorkbookBytes = 10 * 1024 * 1024;

export const app = new Elysia({
  serve: {
    maxRequestBodySize: maximumWorkbookBytes + 1024 * 1024,
    idleTimeout: 120,
  },
})
  .get("/health", () => ({ status: "ok" as const }), {
    response: t.Object({ status: t.Literal("ok") }),
    detail: { tags: ["Health"], summary: "Liveness probe" },
  })
  .use(errorPlugin)
  .use(requestLogPlugin)
  .use(
    cors({
      origin: trustedOrigins,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Organization-Id",
        "X-Branch-Id",
      ],
    }),
  )
  .use(openapiPlugin)
  .use(authController)
  .use(branchesController)
  .use(dashboardController)
  .use(usersController)
  .use(supplierController)
  .use(itemsController)
  .use(mediaController)
  .use(itemCategoriesController)
  .use(unitsController)
  .use(currenciesController)
  .use(systemPreferencesController)
  .use(recipesController)
  .use(orderController)
  .use(financeController)
  .use(salesController)
  .use(posDevicesController);
